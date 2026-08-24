import assert from 'node:assert/strict';
import test from 'node:test';

import { createHandlers } from './handlers.mjs';

const config = {
  owner: 'octo-org', repository: 'widgets', operator: 'yuto90', agentActors: ['yuto90', 'cursor[bot]'],
  labels: { ready: 'agent-ready', cancel: 'agent-cancel' }, defaultBranch: 'main', cursorBranchPrefix: 'cursor/',
  ciWorkflow: 'Pull Request CI', ciRetryLimit: 3,
};
const readyAt = Date.parse('2026-08-24T00:00:00Z');
const submittedAt = Date.parse('2026-08-24T00:01:00Z');

class FakeRepository {
  constructor() {
    this.issue = { id: 120, number: 20, state: 'open', labels: [], title: 'Task' };
    this.pr = { number: 30, state: 'open', draft: false, base: { ref: 'main' }, head: { ref: 'cursor/issue-20-task', sha: 'abcdef', repository: { owner: 'octo-org', name: 'widgets' } } };
    this.comments = [
      { id: 1, author: 'yuto90', body: '<!-- agent:dispatch:v1 issue=20 -->', createdAt: 1 },
      { id: 2, author: 'cursor[bot]', body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->', createdAt: readyAt },
    ];
    this.reviews = [{ id: 101, author: 'yuto90', state: 'changes_requested', submittedAt, commitId: 'abcdef' }];
  }
  async getCurrentPullRequest() { return structuredClone(this.pr); }
  async findClosingIssues() { return [{ id: 'I_20', number: 20, state: 'open' }]; }
  async getIssue() { return structuredClone(this.issue); }
  async listIssueComments() { return structuredClone(this.comments); }
  async listReviews() { return structuredClone(this.reviews); }
  async getHeadCommit() { return { sha: this.pr.head.sha }; }
}

class FakeProject {
  constructor() { this.status = 'Human Review'; this.transitions = []; }
  async getIssueStatus() { return this.status; }
  async transitionIssue(id, target, allowedFrom) {
    if (!allowedFrom.includes(this.status)) throw new Error('stale status');
    this.transitions.push({ id, target, allowedFrom });
    this.status = target;
  }
}

function setup() {
  const repository = new FakeRepository();
  const project = new FakeProject();
  return { repository, project, handlers: createHandlers({ repository, project, config, summary: { add() {} } }) };
}

function event({ id = 101, author = 'yuto90', state = 'changes_requested', commitId = 'abcdef', action = 'submitted', submitted = '2026-08-24T00:01:00Z' } = {}) {
  return {
    action,
    repository: { full_name: 'octo-org/widgets' },
    pull_request: { number: 30 },
    review: { id, user: { login: author }, state, commit_id: commitId, submitted_at: submitted },
  };
}

test('Human Reviewのcurrent headへoperatorがchanges_requestedを送るとReworkへ移す', async () => {
  const { handlers, project } = setup();

  const result = await handlers.handleReview(event());

  assert.deepEqual(result, { kind: 'transition', status: 'Rework' });
  assert.equal(project.status, 'Rework');
  assert.equal(project.transitions.length, 1);
});

test('approved/commented/dismissed・unauthorized・wrong status・stale head・terminalはreviewで遷移しない', async () => {
  const cases = [
    { name: 'approved', event: event({ state: 'approved' }) },
    { name: 'commented', event: event({ state: 'commented' }) },
    { name: 'dismissed', event: event({ state: 'dismissed' }) },
    { name: 'unauthorized', event: event({ author: 'attacker' }) },
    { name: 'wrong status', mutate: ({ project }) => { project.status = 'In Progress'; }, event: event() },
    { name: 'stale head', event: event({ commitId: 'deadbeef' }) },
    { name: 'missing review id', event: event({ id: null }) },
    { name: 'non-positive review id', event: event({ id: 0 }) },
    { name: 'done', mutate: ({ project }) => { project.status = 'Done'; }, event: event() },
    { name: 'cancelled', mutate: ({ project }) => { project.status = 'Cancelled'; }, event: event() },
  ];

  for (const candidate of cases) {
    const context = setup();
    candidate.mutate?.(context);
    const before = context.project.status;
    await context.handlers.handleReview(candidate.event);
    assert.equal(context.project.status, before, candidate.name);
    assert.equal(context.project.transitions.length, 0, candidate.name);
  }
});

test('event review IDと一致するauthoritative API evidenceが現在も有効な場合だけReworkへ移す', async () => {
  for (const { name, mutate } of [
    { name: 'missing', mutate: (repository) => { repository.reviews = []; } },
    { name: 'different-id', mutate: (repository) => { repository.reviews[0].id = 999; } },
    { name: 'dismissed', mutate: (repository) => { repository.reviews[0].state = 'dismissed'; } },
    { name: 'approved', mutate: (repository) => { repository.reviews[0].state = 'approved'; } },
    { name: 'changed-author', mutate: (repository) => { repository.reviews[0].author = 'attacker'; } },
    { name: 'changed-head', mutate: (repository) => { repository.reviews[0].commitId = 'deadbeef'; } },
    { name: 'missing-time', mutate: (repository) => { repository.reviews[0].submittedAt = null; } },
  ]) {
    const { repository, project, handlers } = setup();
    mutate(repository);

    const result = await handlers.handleReview(event());

    assert.notDeepEqual(result, { kind: 'transition', status: 'Rework' }, name);
    assert.equal(project.status, 'Human Review', name);
    assert.equal(project.transitions.length, 0, name);
  }
});

test('review submittedAtはcurrent-head latest readyより厳密に後でなければ古いredeliveryとして無視する', async () => {
  for (const { name, prepare } of [
    { name: 'same-time', prepare: (repository) => { repository.comments[1].createdAt = submittedAt; } },
    { name: 'newer-ready', prepare: (repository) => { repository.comments.push({ id: 3, author: 'cursor[bot]', body: '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abcdef -->', createdAt: submittedAt + 1 }); } },
    { name: 'missing-ready', prepare: (repository) => { repository.comments = repository.comments.slice(0, 1); } },
  ]) {
    const { repository, project, handlers } = setup();
    prepare(repository);

    const result = await handlers.handleReview(event());

    assert.notDeepEqual(result, { kind: 'transition', status: 'Rework' }, name);
    assert.equal(project.status, 'Human Review', name);
  }
});

test('review mutation直前のAPI再取得で同ID reviewがdismissedへ変わったraceを停止する', async () => {
  const { repository, project, handlers } = setup();
  let reads = 0;
  repository.listReviews = async () => {
    reads += 1;
    return [{ ...structuredClone(repository.reviews[0]), state: reads === 1 ? 'changes_requested' : 'dismissed' }];
  };

  const result = await handlers.handleReview(event());

  assert.notDeepEqual(result, { kind: 'transition', status: 'Rework' });
  assert.equal(reads, 2);
  assert.equal(project.status, 'Human Review');
  assert.equal(project.transitions.length, 0);
});

test('review mutation直前のhead/status再読でstale sessionを停止しredeliveryは一度だけ遷移する', async () => {
  for (const race of ['head', 'status']) {
    const context = setup();
    let reads = 0;
    const original = context.repository.getCurrentPullRequest.bind(context.repository);
    context.repository.getCurrentPullRequest = async () => {
      reads += 1;
      if (reads === 2) {
        if (race === 'head') context.repository.pr.head.sha = 'fedcba';
        if (race === 'status') context.project.status = 'In Progress';
      }
      return original();
    };

    await context.handlers.handleReview(event());

    assert.equal(context.project.transitions.length, 0, race);
    assert.equal(reads, 2, race);
  }

  const delivered = setup();
  await delivered.handlers.handleReview(event());
  await delivered.handlers.handleReview(event());
  assert.equal(delivered.project.transitions.length, 1);
  assert.equal(delivered.project.status, 'Rework');
});
