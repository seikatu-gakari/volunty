import assert from 'node:assert/strict';
import test from 'node:test';

import { createHandlers } from './handlers.mjs';
import { AgentRepository } from './repository.mjs';

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
  async getCurrentPullRequest(number) {
    if (number !== 30) return { ...structuredClone(this.pr), number, head: { ...structuredClone(this.pr.head), ref: 'human/fix' } };
    return structuredClone(this.pr);
  }
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
function relation(number = 30, repositoryId = 100) { return { id: number + 1000, number, url: `https://api.github.com/repos/octo-org/widgets/pulls/${number}`, head: { ref: 'fork/cursor', sha: 'f00d', repo: { id: 200, url: 'https://api.github.com/repos/fork/widgets', name: 'widgets' } }, base: { ref: 'main', sha: 'beef', repo: { id: repositoryId, url: 'https://api.github.com/repos/octo-org/widgets', name: 'widgets' } } }; }
function event(workflowRun) { return { action: 'completed', repository: { full_name: 'octo-org/widgets' }, workflow_run: { ...workflowRun, repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()] } }; }

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

test('current headのnewest runがpendingなら古いfailureをretryしない', async () => {
  const { repository, project, handlers } = setup();
  const failed = run(11, 'failure', { updatedAt: 20 });
  repository.runs.push(
    failed,
    { id: 12, name: 'Pull Request CI', status: 'in_progress', conclusion: null, headSha: 'abcdef', updatedAt: 21, url: 'https://ci/12' },
  );

  const result = await handlers.handleCi(event(failed));

  assert.deepEqual(result, { kind: 'skip', reason: 'stale-run' });
  assert.equal(repository.comments.length, 1);
  assert.equal(project.status, 'In Progress');
});

test('same id/headのrunがREST再読込時にin_progressへ戻ったraceではfailure evidenceにしない', async () => {
  const { repository, project, handlers } = setup();
  const failed = run(11, 'failure');
  repository.runs.push(failed);
  let reads = 0;
  repository.listCiRuns = async () => {
    reads += 1;
    return [{ ...structuredClone(failed), status: reads === 1 ? 'completed' : 'in_progress' }];
  };

  const result = await handlers.handleCi(event(failed));

  assert.deepEqual(result, { kind: 'skip', reason: 'stale-run' });
  assert.equal(reads, 2);
  assert.equal(repository.comments.length, 1);
  assert.equal(project.status, 'In Progress');
});

test('未完了failure runに対応するmarkerはtrusted retry evidenceに数えない', async () => {
  const { repository, project, handlers } = setup();
  repository.runs.push(
    ...[11, 12, 13].map((id) => ({ ...run(id, 'failure'), status: id === 13 ? 'in_progress' : 'completed' })),
  );
  repository.comments.push(
    ...[11, 12, 13].map((id, index) => ({
      id: index + 2,
      author: 'yuto90',
      createdAt: id,
      body: `<!-- agent:ci-retry:v1 run_id=${id} head_sha=abcdef retry=${index + 1} -->`,
    })),
  );
  const current = run(14, 'failure');
  repository.runs.push(current);

  const result = await handlers.handleCi(event(current));

  assert.deepEqual(result, { kind: 'retry', retry: 3 });
  assert.equal(project.status, 'In Progress');
  assert.match(repository.comments.at(-1).body, /run_id=14 head_sha=abcdef retry=3/);
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

test('untrusted・unknown・SHA不一致・duplicate IDのretry markerはdedupeもcycle countもしない', async () => {
  const { repository, handlers } = setup();
  const failed = run(11, 'failure');
  repository.runs.push(failed, { ...failed, name: 'Other CI' });
  repository.comments.push(
    { id: 2, author: 'attacker', createdAt: 2, body: '<!-- agent:ci-retry:v1 run_id=11 head_sha=abcdef retry=1 -->' },
    { id: 3, author: 'yuto90', createdAt: 3, body: '<!-- agent:ci-retry:v1 run_id=999 head_sha=abcdef retry=1 -->' },
    { id: 4, author: 'yuto90', createdAt: 4, body: '<!-- agent:ci-retry:v1 run_id=11 head_sha=deadbeef retry=1 -->' },
  );

  const result = await handlers.handleCi(event(failed));

  assert.deepEqual(result, { kind: 'retry', retry: 1 });
  assert.equal(repository.comments.filter((comment) => comment.body.includes('agent:ci-retry')).length, 4);
});

test('same run redeliveryのtrusted markerだけをdedupeし、success後のfailureはretry 1へresetする', async () => {
  const { repository, handlers } = setup();
  const first = run(11, 'failure'); repository.runs.push(first);
  await handlers.handleCi(event(first));
  const redelivery = await handlers.handleCi(event(first));
  const success = run(20, 'success'); repository.runs.push(success);
  const second = run(21, 'failure'); repository.runs.push(second);
  const result = await handlers.handleCi(event(second));

  assert.deepEqual(redelivery, { kind: 'skip', reason: 'already-retried' });
  assert.deepEqual(result, { kind: 'retry', retry: 1 });
  assert.match(repository.comments.at(-1).body, /run_id=21 head_sha=abcdef retry=1/);
});

test('未完了success runのconclusionはretry cycleをresetしない', async () => {
  const { repository, handlers } = setup();
  const first = run(11, 'failure');
  repository.runs.push(first);
  await handlers.handleCi(event(first));
  repository.runs.push({ ...run(20, 'success'), status: 'in_progress' });
  const second = run(21, 'failure');
  repository.runs.push(second);

  const result = await handlers.handleCi(event(second));

  assert.deepEqual(result, { kind: 'retry', retry: 2 });
  assert.match(repository.comments.at(-1).body, /run_id=21 head_sha=abcdef retry=2/);
});

test('success境界と同時刻でもrun IDが後のfailure retry markerは次cycleに数える', async () => {
  const { repository, handlers } = setup();
  const success = run(12, 'success', { updatedAt: 20 });
  const priorFailure = run(13, 'failure', { updatedAt: 20 });
  const currentFailure = run(14, 'failure', { updatedAt: 21 });
  repository.runs.push(success, priorFailure, currentFailure);
  repository.comments.push({ id: 2, author: 'yuto90', createdAt: 21, body: '<!-- agent:ci-retry:v1 run_id=13 head_sha=abcdef retry=1 -->' });

  const result = await handlers.handleCi(event(currentFailure));

  assert.deepEqual(result, { kind: 'retry', retry: 2 });
  assert.match(repository.comments.at(-1).body, /run_id=14 head_sha=abcdef retry=2/);
});

test('marker 3件だけではBlocked evidenceではなく、4回目failureでBlocked後のresumeだけがold readyをinvalidateする', async () => {
  const unblocked = setup();
  unblocked.repository.runs.push(run(11, 'failure'), run(12, 'failure'), run(13, 'failure'), run(14, 'success'));
  unblocked.repository.comments.push(
    { id: 2, author: 'yuto90', createdAt: 11, body: '<!-- agent:ci-retry:v1 run_id=11 head_sha=abcdef retry=1 -->' },
    { id: 3, author: 'yuto90', createdAt: 12, body: '<!-- agent:ci-retry:v1 run_id=12 head_sha=abcdef retry=2 -->' },
    { id: 4, author: 'yuto90', createdAt: 13, body: '<!-- agent:ci-retry:v1 run_id=13 head_sha=abcdef retry=3 -->' },
    { id: 5, author: 'cursor[bot]', createdAt: 10, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' },
    { id: 6, author: 'yuto90', createdAt: 15, body: '@cursor\n進捗を教えてください' },
  );
  const readyBody = unblocked.repository.comments.find((comment) => comment.body.includes('ready-for-review')).body;
  const green = await unblocked.handlers.handleComment({ action: 'created', repository: { full_name: 'octo-org/widgets' }, issue: { number: 30, pull_request: {} }, comment: { user: { login: 'cursor[bot]' }, body: readyBody } });
  assert.deepEqual(green, { kind: 'transition', status: 'Human Review' });
  assert.equal(unblocked.project.status, 'Human Review');

  const blocked = setup();
  blocked.repository.comments.push({ id: 2, author: 'cursor[bot]', createdAt: 5, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' });
  for (const id of [11, 12, 13]) { const failed = run(id, 'failure'); blocked.repository.runs.push(failed); await blocked.handlers.handleCi(event(failed)); }
  const fourth = run(14, 'failure'); blocked.repository.runs.push(fourth);
  assert.deepEqual(await blocked.handlers.handleCi(event(fourth)), { kind: 'transition', status: 'Blocked' });
  blocked.repository.comments.push({ id: 6, author: 'yuto90', createdAt: 20, body: '@cursor\n修正を再開してください' });
  assert.deepEqual(await blocked.handlers.handleComment({ action: 'created', repository: { full_name: 'octo-org/widgets' }, issue: { number: 30, pull_request: {} }, comment: { user: { login: 'yuto90' }, body: '@cursor\n修正を再開してください' } }), { kind: 'transition', status: 'In Progress' });
  const success = run(15, 'success'); blocked.repository.runs.push(success);
  const stale = await blocked.handlers.handleCi(event(success));
  assert.deepEqual(stale, { kind: 'skip', reason: 'invalidated-ready-marker' });
  assert.equal(blocked.project.status, 'In Progress');
});

test('未完了success conclusionはBlocked cycleの境界にならずold readyをinvalidateする', async () => {
  const { repository, project, handlers } = setup();
  repository.comments.push(
    { id: 2, author: 'cursor[bot]', createdAt: 5, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' },
    ...[11, 12, 13].map((id, index) => ({
      id: index + 3,
      author: 'yuto90',
      createdAt: id,
      body: `<!-- agent:ci-retry:v1 run_id=${id} head_sha=abcdef retry=${index + 1} -->`,
    })),
  );
  repository.runs.push(
    run(11, 'failure'),
    run(12, 'failure'),
    run(13, 'failure'),
    { ...run(20, 'success', { updatedAt: 13.5 }), status: 'in_progress' },
    run(14, 'failure'),
    run(15, 'success'),
  );

  const result = await handlers.handleCi(event(repository.runs.at(-1)));

  assert.deepEqual(result, { kind: 'skip', reason: 'invalidated-ready-marker' });
  assert.equal(project.status, 'In Progress');
});

test('retry range外、multi-PR 0/2/duplicate/cross-repoはtrusted candidate境界を守る', async () => {
  const ranged = setup();
  const failed = run(11, 'failure'); ranged.repository.runs.push(failed);
  ranged.repository.comments.push({ id: 2, author: 'yuto90', createdAt: 2, body: '<!-- agent:ci-retry:v1 run_id=11 head_sha=abcdef retry=4 -->' });
  assert.deepEqual(await ranged.handlers.handleCi(event(failed)), { kind: 'retry', retry: 1 });

  for (const { relations, expectedComments } of [
    { relations: [], expectedComments: 1 },
    { relations: [relation(), relation()], expectedComments: 1 },
    { relations: [{ number: 30, base: { repo: { id: 999, url: 'https://api.github.com/repos/fork/widgets', name: 'widgets' } } }], expectedComments: 1 },
  ]) {
    const state = setup(); const candidate = run(11, 'failure'); state.repository.runs.push(candidate);
    const payload = event(candidate); payload.workflow_run.pull_requests = relations;
    await state.handlers.handleCi(payload);
    assert.equal(state.repository.comments.length, expectedComments);
    assert.equal(state.project.status, 'In Progress');
  }
  const ambiguous = setup(); const candidate = run(11, 'failure'); ambiguous.repository.runs.push(candidate);
  ambiguous.repository.getCurrentPullRequest = async (number) => ({ ...structuredClone(ambiguous.repository.pr), number });
  const payload = event(candidate); payload.workflow_run.pull_requests.push(relation(31));
  assert.deepEqual(await ambiguous.handlers.handleCi(payload), { kind: 'skip', reason: 'ambiguous-managed-pull-request' });
  assert.equal(ambiguous.repository.comments.length, 1);
});

test('workflow_runのmanaged relation一件とhuman relationはmanaged PRだけをtrusted解決する', async () => {
  const { repository, handlers } = setup();
  const failed = run(11, 'failure'); repository.runs.push(failed);
  const multi = event(failed);
  multi.workflow_run.pull_requests.push(relation(99));
  const result = await handlers.handleCi(multi);

  assert.deepEqual(result, { kind: 'retry', retry: 1 });
  assert.equal(repository.comments.filter((comment) => comment.body.includes('agent:ci-retry')).length, 1);
});

test('managed relationにmalformed/cross-repoが混在するとtrusted PR read前にevent全体をskipする', async () => {
  for (const bad of [
    (() => { const value = relation(99); delete value.url; return value; })(),
    { ...relation(99), base: { ...relation(99).base, repo: { ...relation(99).base.repo, id: 999, url: 'https://api.github.com/repos/other/widgets' } } },
  ]) {
    const { repository, project, handlers } = setup();
    const failed = run(11, 'failure'); repository.runs.push(failed);
    let reads = 0; const original = repository.getCurrentPullRequest.bind(repository);
    repository.getCurrentPullRequest = async (...args) => { reads += 1; return original(...args); };
    const payload = event(failed); payload.workflow_run.pull_requests.push(bad);
    assert.deepEqual(await handlers.handleCi(payload), { kind: 'skip', reason: 'invalid-pull-request' });
    assert.equal(reads, 0);
    assert.equal(repository.comments.length, 1);
    assert.equal(project.status, 'In Progress');
  }
});

test('same-base fork-head human relationは有効に再解決し唯一managed PRへretryする', async () => {
  const { repository, project, handlers } = setup();
  const failed = run(11, 'failure'); repository.runs.push(failed);
  const payload = event(failed); payload.workflow_run.pull_requests.push(relation(99));
  const result = await handlers.handleCi(payload);
  assert.deepEqual(result, { kind: 'retry', retry: 1 });
  assert.equal(repository.comments.filter((comment) => comment.body.includes('agent:ci-retry')).length, 1);
  assert.equal(project.status, 'In Progress');
});

test('公式minimal relationとoptional run_started_atを受け入れ、過去Blocked/resume後のold readyを再利用しない', async () => {
  const { repository, project, handlers } = setup();
  repository.comments.push(
    { id: 2, author: 'cursor[bot]', createdAt: 5, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' },
    ...[11, 12, 13].map((id, index) => ({ id: index + 3, author: 'yuto90', createdAt: id, body: `<!-- agent:ci-retry:v1 run_id=${id} head_sha=abcdef retry=${index + 1} -->` })),
    { id: 7, author: 'yuto90', createdAt: 20, body: '@cursor\n再開してください' },
    { id: 8, author: 'yuto90', createdAt: 31, body: '<!-- agent:ci-retry:v1 run_id=31 head_sha=abcdef retry=1 -->' },
  );
  repository.runs.push(...[11, 12, 13, 14].map((id) => run(id, 'failure')), run(15, 'success'), run(31, 'failure'), run(32, 'success'));
  const result = await handlers.handleCi(event(repository.runs.at(-1)));
  assert.deepEqual(result, { kind: 'skip', reason: 'invalidated-ready-marker' });
  assert.equal(project.status, 'In Progress');
});

test('CI repository gatewayはobject envelopeをpage=1..Nで全取得しmalformed paginationをfail closedする', async () => {
  const calls = [];
  const workflowRun = (id) => ({
    id, name: 'Pull Request CI', status: 'completed', conclusion: 'failure', head_sha: 'abcdef',
    updated_at: '2026-08-24T00:01:00Z', html_url: `https://ci/${id}`,
    repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()],
  });
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read(path) {
        calls.push(path);
        if (path.endsWith('page=1')) return { total_count: 101, workflow_runs: Array.from({ length: 100 }, (_, index) => workflowRun(index + 1)) };
        if (path.endsWith('page=2')) return { total_count: 101, workflow_runs: [workflowRun(101)] };
        throw new Error(`unexpected ${path}`);
      }, async write() {}, async graphql() {},
    },
  });

  const runs = await repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI');
  assert.equal(runs.length, 101);
  assert.deepEqual(calls, [
    '/repos/octo-org/widgets/actions/runs?branch=cursor%2Fissue-20-task&event=pull_request&per_page=100&page=1',
    '/repos/octo-org/widgets/actions/runs?branch=cursor%2Fissue-20-task&event=pull_request&per_page=100&page=2',
  ]);

  const malformed = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: { async read() { return { total_count: 101, workflow_runs: [] }; }, async write() {}, async graphql() {} },
  });
  await assert.rejects(() => malformed.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'), /pagination/);
});

test('CI repository gatewayはbranch-scoped searchが1000件に達したら不完全履歴としてrejectする', async () => {
  const calls = [];
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read(path) { calls.push(path); return { total_count: 1000, workflow_runs: [] }; },
      async write() {}, async graphql() {},
    },
  });

  await assert.rejects(
    () => repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'),
    (error) => error.message === 'workflow runs branch search reached 1000-result cap',
  );
  assert.deepEqual(calls, ['/repos/octo-org/widgets/actions/runs?branch=cursor%2Fissue-20-task&event=pull_request&per_page=100&page=1']);
});

test('target workflowのqueued・unknown status runもhead/order dataを保持する', async () => {
  const base = (id, status) => ({
    id, name: 'Pull Request CI', status, conclusion: null, head_sha: 'abcdef',
    updated_at: `2026-08-24T00:0${id}:00Z`, html_url: `https://ci/${id}`,
    repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()],
  });
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read() { return { total_count: 2, workflow_runs: [base(1, 'queued'), base(2, 'future_status')] }; },
      async write() {}, async graphql() {},
    },
  });

  assert.deepEqual(await repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'), [
    { id: 1, name: 'Pull Request CI', status: 'queued', conclusion: null, headSha: 'abcdef', updatedAt: Date.parse('2026-08-24T00:01:00Z'), url: 'https://ci/1', pullRequests: [{ number: 30 }] },
    { id: 2, name: 'Pull Request CI', status: null, conclusion: null, headSha: 'abcdef', updatedAt: Date.parse('2026-08-24T00:02:00Z'), url: 'https://ci/2', pullRequests: [{ number: 30 }] },
  ]);
});

test('pagination drift、duplicate ID、overcount、max guardとmalformed enum/timestamp/repositoryはfail closedする', async () => {
  const base = (id) => ({ id, name: 'Pull Request CI', status: 'completed', conclusion: 'failure', head_sha: 'abcdef', run_started_at: '2026-08-24T00:00:00Z', updated_at: '2026-08-24T00:01:00Z', html_url: `https://ci/${id}`, repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()] });
  const cases = [
    { name: 'drift', message: 'workflow runs pagination total_count changed', read: async (path) => path.endsWith('page=1') ? { total_count: 101, workflow_runs: Array.from({ length: 100 }, (_, index) => base(index + 1)) } : { total_count: 102, workflow_runs: [base(101)] } },
    { name: 'duplicate', message: 'workflow runs pagination contains duplicate id', read: async (path) => path.endsWith('page=1') ? { total_count: 101, workflow_runs: [base(1), ...Array.from({ length: 99 }, (_, index) => base(index + 2))] } : { total_count: 101, workflow_runs: [base(1)] } },
    { name: 'overcount', message: 'workflow runs pagination exceeds total_count', read: async () => ({ total_count: 1, workflow_runs: [base(1), base(2)] }) },
    { name: 'max', message: 'workflow runs branch search reached 1000-result cap', read: async () => ({ total_count: 100_001, workflow_runs: [] }) },
    { name: 'timestamp', message: 'workflow runs page 1[0].updated_at must be an ISO date', read: async () => ({ total_count: 1, workflow_runs: [{ ...base(1), updated_at: 'nope' }] }) },
    { name: 'repository', message: 'workflow runs page 1[0].repository must match configured repository', read: async () => ({ total_count: 1, workflow_runs: [{ ...base(1), repository: { id: 999, full_name: 'fork/widgets' } }] }) },
  ];
  for (const { name, message, read } of cases) {
    const repository = new AgentRepository({ config: { owner: 'octo-org', repository: 'widgets' }, client: { read, async write() {}, async graphql() {} } });
    await assert.rejects(() => repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'), (error) => error.message === message, name);
  }
});

test('new repository readsはexact routeとauthor/timestamp/review enum/head SHAをruntime validateする', async () => {
  const paths = [];
  const pull = { number: 30, state: 'open', draft: false, base: { ref: 'main', repo: { full_name: 'octo-org/widgets' } }, head: { ref: 'cursor/x', sha: 'abcdef', repo: { full_name: 'octo-org/widgets', name: 'widgets', owner: { login: 'octo-org' } } } };
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: {
      async read(path) {
        paths.push(path);
        if (path.endsWith('/pulls/30')) return pull;
        if (path.endsWith('/issues/30/comments')) return [{ id: 4, body: 'ready', user: { login: 'cursor[bot]' }, created_at: '2026-08-24T00:00:00Z' }];
        if (path.endsWith('/pulls/30/reviews')) return [{ id: 81, user: { login: 'yuto90' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-08-24T00:01:00Z', commit_id: 'abcdef' }];
        if (path.endsWith('/commits/abcdef')) return { sha: 'abcdef' };
        throw new Error(`unexpected ${path}`);
      }, async write() {}, async graphql() {},
    },
  });
  const current = await repository.getCurrentPullRequest(30);
  assert.deepEqual(await repository.listIssueComments(30), [{ id: 4, author: 'cursor[bot]', body: 'ready', createdAt: Date.parse('2026-08-24T00:00:00Z') }]);
  assert.deepEqual(await repository.listReviews(current), [{ id: 81, author: 'yuto90', state: 'changes_requested', submittedAt: Date.parse('2026-08-24T00:01:00Z'), commitId: 'abcdef' }]);
  assert.deepEqual(await repository.getHeadCommit(current), { sha: 'abcdef' });
  assert.deepEqual(paths, [
    '/repos/octo-org/widgets/pulls/30',
    '/repos/octo-org/widgets/issues/30/comments',
    '/repos/octo-org/widgets/pulls/30/reviews',
    '/repos/octo-org/widgets/commits/abcdef',
  ]);
});

test('official nullable workflow run/reviewは無関係なら停止せず、PENDING reviewをinvalidatorにしない', async () => {
  const optionalRun = { id: 41, name: undefined, status: null, conclusion: null, repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()] };
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: { async read(path) {
      if (path.includes('/actions/runs')) return { total_count: 1, workflow_runs: [optionalRun] };
      if (path.endsWith('/reviews')) return [{ id: 82, user: null, state: 'PENDING', submitted_at: undefined, commit_id: undefined }];
      throw new Error(`unexpected ${path}`);
    }, async write() {}, async graphql() {} },
  });
  assert.deepEqual(await repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'), []);
  assert.deepEqual(await repository.listReviews({ number: 30 }), [{ id: 82, author: null, state: 'pending', submittedAt: null, commitId: null }]);
});

test('nullable nameと未知statusのunrelated runは個別に非候補となり、target completedの欠落はexact rejectする', async () => {
  const base = (id, extra = {}) => ({ id, name: 'Pull Request CI', status: 'completed', conclusion: 'success', head_sha: 'abcdef', updated_at: '2026-08-24T00:01:00Z', html_url: `https://ci/${id}`, repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()], ...extra });
  for (const value of [{ name: null, status: 'completed' }, { name: 'Other CI', status: 'future_unknown_value' }]) {
    const repository = new AgentRepository({ config: { owner: 'octo-org', repository: 'widgets' }, client: { async read() { return { total_count: 1, workflow_runs: [base(51, value)] }; }, async write() {}, async graphql() {} } });
    assert.deepEqual(await repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'), []);
  }
  for (const [extra, message] of [
    [{ conclusion: 'not-a-conclusion' }, 'workflow runs page 1[0].conclusion must be a workflow conclusion'],
    [{ head_sha: undefined }, 'workflow runs page 1[0].head_sha must be a non-empty string'],
  ]) {
    const repository = new AgentRepository({ config: { owner: 'octo-org', repository: 'widgets' }, client: { async read() { return { total_count: 1, workflow_runs: [base(52, extra)] }; }, async write() {}, async graphql() {} } });
    await assert.rejects(() => repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'), (error) => error.message === message);
  }
});

test('pagination prematureとexpected-pagesは他guardに先行されずexact messageでrejectする', async () => {
  const valid = (id) => ({ id, name: 'Pull Request CI', status: 'completed', conclusion: 'success', head_sha: 'abcdef', updated_at: '2026-08-24T00:01:00Z', html_url: `https://ci/${id}`, repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()] });
  for (const [message, read] of [
    ['workflow runs pagination ended prematurely', async () => ({ total_count: 1, workflow_runs: [] })],
    ['workflow runs pagination exceeded expected pages', async (path) => path.endsWith('page=1') ? { total_count: 101, workflow_runs: [valid(61)] } : path.endsWith('page=2') ? { total_count: 101, workflow_runs: [valid(62)] } : (() => { throw new Error('page 3 must not be read'); })()],
  ]) {
    const repository = new AgentRepository({ config: { owner: 'octo-org', repository: 'widgets' }, client: { read, async write() {}, async graphql() {} } });
    await assert.rejects(() => repository.listCiRuns({ number: 30, head: { ref: 'cursor/issue-20-task' } }, 'Pull Request CI'), (error) => error.message === message);
  }
});

test('getLatestCiRunはcurrent headのnewest target runをstatus判定前に返す', async () => {
  const repository = new AgentRepository({
    config: { owner: 'octo-org', repository: 'widgets' },
    client: { async read() { return { total_count: 3, workflow_runs: [
      { id: 71, name: 'Pull Request CI', status: null, conclusion: null, head_sha: 'abcdef', updated_at: '2026-08-24T00:00:00Z', html_url: 'https://ci/71', repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()] },
      { id: 72, name: 'Pull Request CI', status: 'completed', conclusion: 'success', head_sha: 'abcdef', updated_at: '2026-08-24T00:01:00Z', html_url: 'https://ci/72', repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()] },
      { id: 73, name: 'Pull Request CI', status: 'queued', conclusion: null, head_sha: 'abcdef', updated_at: '2026-08-24T00:02:00Z', html_url: 'https://ci/73', repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [relation()] },
    ] }; }, async write() {}, async graphql() {} },
  });
  assert.deepEqual(await repository.getLatestCiRun({ number: 30, head: { ref: 'cursor/issue-20-task', sha: 'abcdef' } }, 'Pull Request CI'), { id: 73, name: 'Pull Request CI', status: 'queued', conclusion: null, headSha: 'abcdef', updatedAt: Date.parse('2026-08-24T00:02:00Z'), url: 'https://ci/73', pullRequests: [{ number: 30 }] });
});
