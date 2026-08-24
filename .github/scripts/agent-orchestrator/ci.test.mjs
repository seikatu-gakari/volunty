import assert from 'node:assert/strict';
import test from 'node:test';

import { createHandlers } from './handlers.mjs';

const config = {
  owner: 'octo-org', repository: 'widgets', operator: 'yuto90', agentActors: ['yuto90', 'cursor[bot]'],
  labels: { ready: 'agent-ready', cancel: 'agent-cancel' }, defaultBranch: 'main', cursorBranchPrefix: 'cursor/',
  ciWorkflow: 'Pull Request CI', ciRetryLimit: 3,
};
const dispatch = '<!-- agent:dispatch:v1 issue=20 -->';
class FakeRepository {
  constructor() {
    this.issue = { id: 120, number: 20, state: 'open', labels: [] };
    this.pr = { number: 30, state: 'open', draft: false, base: { ref: 'main' }, head: { ref: 'cursor/issue-20-task', sha: 'abcdef', repository: { owner: 'octo-org', name: 'widgets' } } };
    this.comments = [{ id: 1, author: 'yuto90', body: dispatch, createdAt: 1 }]; this.runs = []; this.reviews = [];
  }
  async getCurrentPullRequest() { return structuredClone(this.pr); }
  async getPullRequest() { return structuredClone(this.pr); }
  async findClosingIssues() { return [structuredClone(this.issue)]; }
  async getIssue() { return structuredClone(this.issue); }
  async listComments() { return structuredClone(this.comments); }
  async listReviews() { return structuredClone(this.reviews); }
  async getLatestCiRun() { return structuredClone(this.runs.at(-1) ?? null); }
  async listCiRuns() { return structuredClone(this.runs); }
  async getHeadCommit() { return { sha: this.pr.head.sha }; }
  async postComment(_number, body) { this.comments.push({ id: this.comments.length + 1, author: 'yuto90', body, createdAt: 100 + this.comments.length }); }
}
class FakeProject { constructor() { this.status = 'In Progress'; } async getIssueStatus() { return this.status; } async transitionIssue(_id, target, allowed) { if (!allowed.includes(this.status)) throw new Error('stale'); this.status = target; } }
function setup() { const repository = new FakeRepository(); const project = new FakeProject(); return { repository, project, handlers: createHandlers({ repository, project, config, summary: { add() {} } }) }; }
function run(id, conclusion, { sha = 'abcdef', updatedAt = id, name = 'Pull Request CI' } = {}) { return { id, name, status: 'completed', conclusion, headSha: sha, runStartedAt: id - 1, updatedAt, url: `https://ci/${id}` }; }
function event(workflowRun) { return { action: 'completed', repository: { full_name: 'octo-org/widgets' }, workflow_run: { ...workflowRun, pull_requests: [{ number: 30, base: { repo: { full_name: 'octo-org/widgets' } } }] } }; }

test('current headのnewest applicable failureだけがretry 1/2/3を一度ずつ投稿し4回目でBlockedへ移す', async () => {
  const { repository, project, handlers } = setup();
  for (const id of [11, 12, 13]) {
    const failed = run(id, 'failure'); repository.runs.push(failed);
    await handlers.handleCi(event(failed));
  }
  const fourth = run(14, 'failure'); repository.runs.push(fourth);
  const result = await handlers.handleCi(event(fourth));

  assert.equal(repository.comments.filter((comment) => comment.body.includes('agent:ci-retry')).length, 3);
  assert.deepEqual(result, { kind: 'transition', status: 'Blocked' });
  assert.equal(project.status, 'Blocked');
  assert.match(repository.comments[1].body, /@cursor/);
  assert.match(repository.comments[3].body, /run_id=13 head_sha=abcdef retry=3/);
});

test('stale SHA・old run/redelivery・cancelled/wrong workflow・terminal sessionはretry/statusを変えない', async () => {
  const cases = [
    (state) => run(10, 'failure', { sha: 'old-head' }),
    (state) => { state.repository.runs.push(run(11, 'failure'), run(12, 'failure')); return state.repository.runs[0]; },
    () => run(10, 'cancelled'),
    () => run(10, 'failure', { name: 'Other CI' }),
    (state) => { state.project.status = 'Done'; return run(10, 'failure'); },
  ];
  for (const makeRun of cases) {
    const state = setup(); const candidate = makeRun(state); if (!state.repository.runs.some((entry) => entry.id === candidate.id)) state.repository.runs.push(candidate);
    await state.handlers.handleCi(event(candidate));
    assert.equal(state.repository.comments.length, 1);
    assert.ok(['In Progress', 'Done'].includes(state.project.status));
  }
});

test('success後のretry markerだけを数えるためpushでheadが変わっても3回上限をresetしない', async () => {
  const { repository, project, handlers } = setup();
  for (const id of [11, 12, 13]) { const failed = run(id, 'failure'); repository.runs.push(failed); await handlers.handleCi(event(failed)); }
  repository.pr.head.sha = 'aabbcc';
  const failed = run(14, 'failure', { sha: 'aabbcc' }); repository.runs.push(failed);
  await handlers.handleCi(event(failed));

  assert.equal(project.status, 'Blocked');
  assert.equal(repository.comments.filter((comment) => comment.body.includes('agent:ci-retry')).length, 3);
});

test('ready firstとCI success firstはいずれもcurrent headでHuman Reviewへ収束する', async () => {
  for (const order of ['ready-first', 'ci-first']) {
    const { repository, project, handlers } = setup();
    const ready = { id: 2, author: 'cursor[bot]', createdAt: 20, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' };
    const success = run(11, 'success', { updatedAt: 21 });
    if (order === 'ready-first') repository.comments.push(ready); else repository.runs.push(success);
    if (order === 'ready-first') await handlers.handleComment({ action: 'created', repository: { full_name: 'octo-org/widgets' }, issue: { number: 30, pull_request: {} }, comment: { user: { login: 'cursor[bot]' }, body: ready.body } });
    else await handlers.handleCi(event(success));
    if (order === 'ready-first') { repository.runs.push(success); await handlers.handleCi(event(success)); }
    else { repository.comments.push(ready); await handlers.handleComment({ action: 'created', repository: { full_name: 'octo-org/widgets' }, issue: { number: 30, pull_request: {} }, comment: { user: { login: 'cursor[bot]' }, body: ready.body } }); }
    assert.equal(project.status, 'Human Review', order);
  }
});
