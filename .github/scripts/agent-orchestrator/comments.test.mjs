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
  constructor() { this.status = 'In Progress'; this.transitions = []; }
  async getIssueStatus() { return this.status; }
  async transitionIssue(id, target, allowed) {
    if (!allowed.includes(this.status)) throw new Error('stale');
    this.transitions.push({ id, target, allowed });
    this.status = target;
  }
}
function setup() {
  const repository = new FakeRepository();
  const project = new FakeProject();
  return { repository, project, handlers: createHandlers({ repository, project, config, summary: { add() {} } }) };
}
function event({ author = 'cursor[bot]', body, pullRequest = true, createdAt = 100 } = {}) {
  return {
    action: 'created', repository: { full_name: 'octo-org/widgets' },
    issue: { number: 30, ...(pullRequest ? { pull_request: { url: 'trusted' } } : {}) },
    comment: { id: 900, user: { login: author }, body, created_at: createdAt },
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

test('Human Review中のoperator @cursorはauthoritative changes_requestedを照合しRework経由でIn Progressへ再開する', async () => {
  const { repository, project, handlers } = setup();
  project.status = 'Human Review';
  repository.comments.push({
    id: 2,
    author: 'cursor[bot]',
    body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->',
    createdAt: 20,
  });
  repository.reviews.push({ id: 81, author: 'yuto90', state: 'changes_requested', submittedAt: 21, commitId: 'abcdef' });

  const result = await handlers.handleComment(event({ author: 'yuto90', body: '@cursor\n指摘を修正してください' }));

  assert.deepEqual(result, { kind: 'transition', status: 'In Progress' });
  assert.equal(project.status, 'In Progress');
  assert.deepEqual(project.transitions.map(({ target }) => target), ['Rework', 'In Progress']);
  assert.deepEqual(project.transitions.map(({ allowed }) => allowed), [['Human Review'], ['Rework']]);
});

test('Human Review中の@cursorはreview証拠がない・古い・他author・曖昧・terminal・raceならno-op', async () => {
  const cases = [
    { name: 'missing', mutate: () => {}, reason: 'review-evidence-missing' },
    { name: 'old', mutate: ({ repository }) => { repository.reviews.push({ id: 81, author: 'yuto90', state: 'changes_requested', submittedAt: 19, commitId: 'abcdef' }); }, reason: 'stale-review' },
    { name: 'other author', mutate: ({ repository }) => { repository.reviews.push({ id: 81, author: 'attacker', state: 'changes_requested', submittedAt: 21, commitId: 'abcdef' }); }, reason: 'review-evidence-missing' },
    {
      name: 'ambiguous',
      mutate: ({ repository }) => { repository.reviews.push(
        { id: 81, author: 'yuto90', state: 'changes_requested', submittedAt: 21, commitId: 'abcdef' },
        { id: 82, author: 'yuto90', state: 'changes_requested', submittedAt: 21, commitId: 'abcdef' },
      ); },
      reason: 'ambiguous-review-evidence',
    },
    { name: 'terminal', mutate: ({ project }) => { project.status = 'Done'; }, reason: 'terminal' },
    {
      name: 'review race',
      mutate: ({ repository }) => {
        repository.reviews.push({ id: 81, author: 'yuto90', state: 'changes_requested', submittedAt: 21, commitId: 'abcdef' });
        let reads = 0;
        repository.listReviews = async () => {
          reads += 1;
          return [{ ...structuredClone(repository.reviews[0]), state: reads === 1 ? 'changes_requested' : 'dismissed' }];
        };
      },
      reason: 'review-not-changes-requested',
    },
  ];

  for (const candidate of cases) {
    const context = setup();
    context.project.status = 'Human Review';
    context.repository.comments.push({
      id: 2,
      author: 'cursor[bot]',
      body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->',
      createdAt: 20,
    });
    candidate.mutate(context);
    const result = await context.handlers.handleComment(event({ author: 'yuto90', body: '@cursor\n修正してください' }));
    assert.deepEqual(result, { kind: 'skip', reason: candidate.reason }, candidate.name);
    assert.equal(context.project.transitions.length, 0, candidate.name);
  }
});

test('新しいchanges_requestedより古い@cursor redeliveryはRework/resume証拠に再利用しない', async () => {
  const { repository, project, handlers } = setup();
  project.status = 'Human Review';
  repository.comments.push({ id: 2, author: 'cursor[bot]', body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->', createdAt: 20 });
  repository.reviews.push({ id: 81, author: 'yuto90', state: 'changes_requested', submittedAt: 30, commitId: 'abcdef' });

  const result = await handlers.handleComment(event({ author: 'yuto90', body: '@cursor\n以前の再開コメント', createdAt: 25 }));

  assert.deepEqual(result, { kind: 'skip', reason: 'stale-review-resume' });
  assert.equal(project.status, 'Human Review');
  assert.equal(project.transitions.length, 0);
});

test('Human ReviewからRework後のresume raceはIn Progress遷移を停止し、redeliveryで既存Rework resumeが完了する', async () => {
  const { repository, project, handlers } = setup();
  project.status = 'Human Review';
  repository.comments.push({ id: 2, author: 'cursor[bot]', body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->', createdAt: 20 });
  repository.reviews.push({ id: 81, author: 'yuto90', state: 'changes_requested', submittedAt: 21, commitId: 'abcdef' });
  let reads = 0;
  const original = repository.getCurrentPullRequest.bind(repository);
  repository.getCurrentPullRequest = async () => {
    reads += 1;
    if (reads === 4) repository.pr.head.sha = 'fedcba';
    return original();
  };

  const first = await handlers.handleComment(event({ author: 'yuto90', body: '@cursor\n修正してください' }));

  assert.deepEqual(first, { kind: 'skip', reason: 'stale-session' });
  assert.equal(project.status, 'Rework');
  assert.deepEqual(project.transitions.map(({ target }) => target), ['Rework']);

  repository.pr.head.sha = 'abcdef';
  const replay = await handlers.handleComment(event({ author: 'yuto90', body: '@cursor\n修正してください' }));
  assert.deepEqual(replay, { kind: 'transition', status: 'In Progress' });
  assert.equal(project.status, 'In Progress');
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

test('PENDING reviewのnullable user/submittedAtはHuman Review gateをinvalidateしない', async () => {
  const { repository, project, handlers } = setup();
  const ready = '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->';
  repository.comments.push({ id: 2, author: 'cursor[bot]', createdAt: 20, body: ready });
  repository.reviews.push({ author: null, state: 'pending', submittedAt: null, commitId: null });
  repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', updatedAt: 21, url: 'https://ci/7' });
  assert.deepEqual(await handlers.handleComment(event({ body: ready })), { kind: 'transition', status: 'Human Review' });
  assert.equal(project.status, 'Human Review');
});

test('operator changes_requestedのsubmittedAtが不明ならHuman Review gateをfail closedする', async () => {
  const { repository, project, handlers } = setup();
  const ready = '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->';
  repository.comments.push({ id: 2, author: 'cursor[bot]', createdAt: 20, body: ready });
  repository.reviews.push({ author: 'yuto90', state: 'changes_requested', submittedAt: null, commitId: 'abcdef' });
  repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', updatedAt: 21, url: 'https://ci/7' });

  const result = await handlers.handleComment(event({ body: ready }));

  assert.deepEqual(result, { kind: 'skip', reason: 'invalidated-ready-marker' });
  assert.equal(project.status, 'In Progress');
});

test('changes_requested後はReworkに新readyとgreenが揃ってもoperator resumeなしではHuman Reviewへ戻さない', async () => {
  const { repository, project, handlers } = setup();
  project.status = 'Rework';
  const ready = '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->';
  repository.reviews.push({ author: 'yuto90', state: 'changes_requested', submittedAt: 20, commitId: 'abcdef' });
  repository.comments.push({ id: 2, author: 'cursor[bot]', createdAt: 30, body: ready });
  repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', updatedAt: 31, url: 'https://ci/7' });

  const result = await handlers.handleComment(event({ body: ready }));

  assert.deepEqual(result, { kind: 'skip', reason: 'review-resume-required' });
  assert.equal(project.status, 'Rework');
});

test('dismissed reviewもresume/new readyの順序を満たすまでold evidenceを再利用しない', async () => {
  for (const { name, submittedAt, readyAt, resumeAt, expected, reason } of [
    { name: 'unknown-dismissed', submittedAt: null, readyAt: 30, resumeAt: null, expected: 'In Progress', reason: 'invalidated-ready-marker' },
    { name: 'old-ready-after-resume', submittedAt: 20, readyAt: 10, resumeAt: 21, expected: 'Rework', reason: 'invalidated-ready-marker' },
    { name: 'new-ready-after-resume', submittedAt: 20, readyAt: 22, resumeAt: 21, expected: 'Human Review', reason: null },
  ]) {
    const { repository, project, handlers } = setup();
    project.status = name === 'unknown-dismissed' ? 'In Progress' : 'Rework';
    const ready = '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->';
    repository.reviews.push({ author: 'yuto90', state: 'dismissed', submittedAt, commitId: 'abcdef' });
    repository.comments.push({ id: 2, author: 'cursor[bot]', createdAt: readyAt, body: ready });
    if (resumeAt !== null) repository.comments.push({ id: 3, author: 'yuto90', createdAt: resumeAt, body: '@cursor\n修正を再開してください' });
    repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', updatedAt: 31, url: 'https://ci/7' });

    const result = await handlers.handleComment(event({ body: ready }));

    if (reason === null) assert.deepEqual(result, { kind: 'transition', status: 'Human Review' }, name);
    else assert.deepEqual(result, { kind: 'skip', reason }, name);
    assert.equal(project.status, expected, name);
  }
});

test('current headのnewest runがqueuedなら古いsuccessでHuman Reviewへ移さない', async () => {
  const { repository, project, handlers } = setup();
  const ready = '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->';
  repository.comments.push({ id: 2, author: 'cursor[bot]', createdAt: 20, body: ready });
  repository.runs.push(
    { id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', updatedAt: 21, url: 'https://ci/7' },
    { id: 8, name: 'Pull Request CI', status: 'queued', conclusion: null, headSha: 'abcdef', updatedAt: 22, url: 'https://ci/8' },
  );

  const result = await handlers.handleComment(event({ body: ready }));

  assert.deepEqual(result, { kind: 'skip', reason: 'ci-not-green' });
  assert.equal(project.status, 'In Progress');
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

test('Human Inputまたはchanges requested後の最初のoperator resumeだけがreadyをinvalidateし、In Progress中のunpaired mentionは無視する', async () => {
  for (const { name, comments, reviews, expected } of [
    {
      name: 'unpaired',
      comments: [
        { id: 2, author: 'yuto90', createdAt: 15, body: '@cursor\n途中経過を教えてください' },
        { id: 3, author: 'cursor[bot]', createdAt: 20, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' },
      ], reviews: [], expected: 'Human Review',
    },
    {
      name: 'accepted-human-input-resume',
      comments: [
        { id: 2, author: 'cursor[bot]', createdAt: 20, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' },
        { id: 3, author: 'cursor[bot]', createdAt: 21, body: '<!-- agent:human-input -->' },
        { id: 4, author: 'yuto90', createdAt: 22, body: '@cursor\n選択肢Aで進めてください' },
      ], reviews: [], expected: 'In Progress',
    },
    {
      name: 'accepted-review-resume',
      comments: [
        { id: 2, author: 'cursor[bot]', createdAt: 20, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' },
        { id: 3, author: 'yuto90', createdAt: 22, body: '@cursor\n修正をお願いします' },
      ], reviews: [{ author: 'yuto90', state: 'changes_requested', submittedAt: 21, commitId: 'abcdef' }], expected: 'In Progress',
    },
  ]) {
    const { repository, project, handlers } = setup();
    repository.comments.push(...comments); repository.reviews.push(...reviews);
    repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', runStartedAt: 10, updatedAt: 23, url: 'https://ci/7' });
    await handlers.handleComment(event({ body: repository.comments.find((comment) => comment.body.includes('ready-for-review'))?.body }));
    assert.equal(project.status, expected, name);
  }
});

test('Human Review second full gateは3回目のPR readで変異したdraft/failure/Human Input/review/head/status/terminalを停止する', async () => {
  for (const race of ['draft', 'failure', 'human-input', 'changes-requested', 'head', 'status', 'terminal']) {
    const { repository, project, handlers } = setup();
    const ready = { id: 2, author: 'cursor[bot]', createdAt: 20, body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->' };
    repository.comments.push(ready);
    repository.runs.push({ id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'success', headSha: 'abcdef', runStartedAt: 10, updatedAt: 21, url: 'https://ci/7' });
    let reads = 0;
    const originalCurrentPr = repository.getCurrentPullRequest.bind(repository);
    repository.getCurrentPullRequest = async (...args) => {
      reads += 1;
      if (reads === 3) {
        if (race === 'draft') repository.pr.draft = true;
        if (race === 'failure') repository.runs.push({ id: 8, name: 'Pull Request CI', status: 'completed', conclusion: 'failure', headSha: 'abcdef', runStartedAt: 10, updatedAt: 22, url: 'https://ci/8' });
        if (race === 'human-input') repository.comments.push({ id: 3, author: 'cursor[bot]', createdAt: 22, body: '<!-- agent:human-input -->' });
        if (race === 'changes-requested') repository.reviews.push({ author: 'yuto90', state: 'changes_requested', submittedAt: 22, commitId: 'abcdef' });
        if (race === 'head') repository.pr.head.sha = 'aabbcc';
        if (race === 'status') project.status = 'Blocked';
        if (race === 'terminal') repository.issue.labels.push('agent-cancel');
      }
      return originalCurrentPr(...args);
    };
    const result = await handlers.handleComment(event({ body: ready.body }));
    assert.notDeepEqual(result, { kind: 'transition', status: 'Human Review' }, race);
    assert.equal(project.status, race === 'status' ? 'Blocked' : 'In Progress', race);
    assert.equal(reads, 3, race);
  }
});
