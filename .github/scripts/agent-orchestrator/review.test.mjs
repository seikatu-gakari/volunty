import assert from 'node:assert/strict';
import test from 'node:test';

import { createHandlers } from './handlers.mjs';

const config = {
  owner: 'octo-org', repository: 'widgets', operator: 'yuto90', agentActors: ['yuto90', 'cursor[bot]'],
  labels: { ready: 'agent-ready', cancel: 'agent-cancel' }, defaultBranch: 'main', cursorBranchPrefix: 'cursor/',
  ciWorkflow: 'Pull Request CI', ciRetryLimit: 3,
};

class FakeRepository {
  constructor() {
    this.issue = { id: 120, number: 20, state: 'open', labels: [], title: 'Task' };
    this.pr = { number: 30, state: 'open', draft: false, base: { ref: 'main' }, head: { ref: 'cursor/issue-20-task', sha: 'abcdef', repository: { owner: 'octo-org', name: 'widgets' } } };
    this.comments = [{ id: 1, author: 'yuto90', body: '<!-- agent:dispatch:v1 issue=20 -->', createdAt: 1 }];
  }
  async getCurrentPullRequest() { return structuredClone(this.pr); }
  async findClosingIssues() { return [{ id: 'I_20', number: 20, state: 'open' }]; }
  async getIssue() { return structuredClone(this.issue); }
  async listIssueComments() { return structuredClone(this.comments); }
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

function event({ author = 'yuto90', state = 'changes_requested', commitId = 'abcdef', action = 'submitted' } = {}) {
  return {
    action,
    repository: { full_name: 'octo-org/widgets' },
    pull_request: { number: 30 },
    review: { user: { login: author }, state, commit_id: commitId, submitted_at: '2026-08-24T00:00:00Z' },
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
