import assert from 'node:assert/strict';
import test from 'node:test';

import { createHandlers } from './handlers.mjs';

const config = {
  owner: 'octo-org', repository: 'widgets', operator: 'yuto90',
  agentActors: ['yuto90', 'cursor[bot]'],
  labels: { ready: 'agent-ready', cancel: 'agent-cancel' },
  defaultBranch: 'main', cursorBranchPrefix: 'cursor/', ciWorkflow: 'Pull Request CI', ciRetryLimit: 3,
};
const dispatch = '<!-- agent:dispatch:v1 issue=20 -->';

class FakeRepository {
  constructor() {
    this.issue = { id: 120, number: 20, state: 'open', labels: [] };
    this.pr = { number: 30, state: 'open', draft: false, base: { ref: 'main' }, head: { ref: 'cursor/issue-20-task', sha: 'abcdef', repository: { owner: 'octo-org', name: 'widgets' } } };
    this.comments = [{ id: 1, author: 'yuto90', body: dispatch, createdAt: 1 }];
    this.reviews = [];
    this.runs = [];
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
}
class FakeProject {
  constructor() { this.status = 'In Progress'; }
  async getIssueStatus() { return this.status; }
  async transitionIssue(_id, target, allowed) {
    if (!allowed.includes(this.status)) throw new Error('stale');
    this.status = target;
  }
}
function setup() {
  const repository = new FakeRepository();
  const project = new FakeProject();
  return { repository, project, handlers: createHandlers({ repository, project, config, summary: { add() {} } }) };
}
function event({ author = 'cursor[bot]', body, pullRequest = true } = {}) {
  return {
    action: 'created', repository: { full_name: 'octo-org/widgets' },
    issue: { number: 30, ...(pullRequest ? { pull_request: { url: 'trusted' } } : {}) },
    comment: { user: { login: author }, body },
  };
}

test('Agentのexact Human Input markerだけがmanaged PRをHuman Inputへ移す', async () => {
  const { handlers, project } = setup();

  const result = await handlers.handleComment(event({ body: '判断が必要です\n<!-- agent:human-input -->' }));

  assert.deepEqual(result, { kind: 'transition', status: 'Human Input' });
  assert.equal(project.status, 'Human Input');
});

test('operatorのstandalone @cursorだけがHuman Input・Blocked・Reworkから再開する', async () => {
  for (const status of ['Human Input', 'Blocked', 'Rework']) {
    const { handlers, project } = setup();
    project.status = status;

    const result = await handlers.handleComment(event({ author: 'yuto90', body: '@cursor\nこちらで進めてください' }));

    assert.deepEqual(result, { kind: 'transition', status: 'In Progress' }, status);
    assert.equal(project.status, 'In Progress', status);
  }
});

test('Issue comment・unauthorized・通常文・stale relation・terminal sessionはPR statusを変えない', async () => {
  const cases = [
    (state) => event({ body: '<!-- agent:human-input -->', pullRequest: false }),
    () => event({ author: 'attacker', body: '@cursor' }),
    () => event({ author: 'yuto90', body: 'お願いします' }),
    (state) => { state.repository.pr.head.ref = 'human/fix'; return event({ body: '<!-- agent:human-input -->' }); },
    (state) => { state.project.status = 'Cancelled'; return event({ author: 'yuto90', body: '@cursor' }); },
  ];
  for (const makeEvent of cases) {
    const state = setup();
    const candidate = makeEvent(state);
    const original = state.project.status;
    await state.handlers.handleComment(candidate);
    assert.equal(state.project.status, original);
  }
});

test('current-headのlatest ready markerとcurrent CI successだけがHuman Reviewへ移す', async () => {
  const { repository, project, handlers } = setup();
  repository.comments.push({ id: 2, author: 'cursor[bot]', createdAt: 20, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' });
  repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', runStartedAt: 10, updatedAt: 21, url: 'https://ci/7' });

  const result = await handlers.handleComment(event({ body: repository.comments[1].body }));

  assert.deepEqual(result, { kind: 'transition', status: 'Human Review' });
  assert.equal(project.status, 'Human Review');
});

test('Human Input・accepted resume・changes requested後の古いready markerは再利用しない', async () => {
  const { repository, project, handlers } = setup();
  repository.comments.push(
    { id: 2, author: 'cursor[bot]', createdAt: 20, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' },
    { id: 3, author: 'cursor[bot]', createdAt: 21, body: '<!-- agent:human-input -->' },
  );
  repository.reviews.push({ author: 'yuto90', state: 'changes_requested', submittedAt: 22, commitId: 'abcdef' });
  repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', runStartedAt: 10, updatedAt: 23, url: 'https://ci/7' });

  const result = await handlers.handleComment(event({ body: repository.comments[1].body }));

  assert.deepEqual(result, { kind: 'skip', reason: 'invalidated-ready-marker' });
  assert.equal(project.status, 'In Progress');
});
