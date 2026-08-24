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
    this.issue = { id: 120, number: 20, state: 'open', labels: ['agent-cancel'], title: 'Task' };
    this.pr = { number: 30, state: 'open', draft: false, base: { ref: 'main' }, head: { ref: 'cursor/issue-20-task', sha: 'abcdef', repository: { owner: 'octo-org', name: 'widgets' } } };
    this.labelActor = 'yuto90';
    this.closingPullRequests = [{ id: 'P_30', number: 30, state: 'open', isDraft: false, baseRefName: 'main', headRefName: 'cursor/issue-20-task', headRepository: { owner: 'octo-org', name: 'widgets' } }];
    this.comments = [{ id: 1, author: 'yuto90', body: '<!-- agent:dispatch:v1 issue=20 -->', createdAt: 1 }];
    this.runs = [];
    this.reviews = [];
    this.mutations = [];
  }
  async getIssue() { return structuredClone(this.issue); }
  async getLatestLabelActor() { return this.labelActor; }
  async findClosingPullRequests() { return structuredClone(this.closingPullRequests); }
  async findClosingIssues() { return [{ id: 'I_20', number: 20, state: this.issue.state }]; }
  async getCurrentPullRequest() { return structuredClone(this.pr); }
  async getPullRequest() { return structuredClone(this.pr); }
  async getCompletionPullRequest() { return { ...structuredClone(this.pr), merged: false }; }
  async getHeadCommit() { return { sha: this.pr.head.sha }; }
  async listIssueComments() { return structuredClone(this.comments); }
  async listComments() { return structuredClone(this.comments); }
  async listIssueDependencies() { return []; }
  async listBlockedBy() { return []; }
  async listReviews() { return structuredClone(this.reviews); }
  async listCiRuns() { return structuredClone(this.runs); }
  async postComment(number, body) { this.mutations.push({ kind: 'comment', number, body }); }
  async removeLabel(number, label) { this.mutations.push({ kind: 'remove-label', number, label }); }
}

class FakeProject {
  constructor() { this.status = 'In Progress'; this.transitions = []; this.ensureCalls = 0; }
  async getIssueStatus() { return this.status; }
  async ensureIssueItem() { this.ensureCalls += 1; }
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

function cancelEvent({ sender = 'yuto90', label = 'agent-cancel' } = {}) {
  return { action: 'labeled', repository: { full_name: 'octo-org/widgets' }, issue: { number: 20 }, label: { name: label }, sender: { login: sender } };
}

test('latest agent-cancel label actorがoperatorのmanaged IssueだけをCancelledへ移す', async () => {
  const { handlers, project } = setup();

  const result = await handlers.handleCancel(cancelEvent());

  assert.deepEqual(result, { kind: 'transition', status: 'Cancelled' });
  assert.equal(project.status, 'Cancelled');
  assert.equal(project.transitions.length, 1);
});

test('agent-ready中でPR未作成のIssueもoperator cancelを受け入れる', async () => {
  const { repository, project, handlers } = setup();
  repository.issue.labels.push('agent-ready');
  repository.closingPullRequests = [];
  project.status = 'Backlog';

  assert.deepEqual(await handlers.handleCancel(cancelEvent()), { kind: 'transition', status: 'Cancelled' });
  assert.equal(project.status, 'Cancelled');
});

test('unauthorized/latest actor不一致・wrong label・unrelated/closed Issue・terminalはcancelしない', async () => {
  const cases = [
    { name: 'event sender unauthorized', event: cancelEvent({ sender: 'attacker' }) },
    { name: 'latest actor mismatch', mutate: ({ repository }) => { repository.labelActor = 'attacker'; } },
    { name: 'wrong label', event: cancelEvent({ label: 'agent-ready' }) },
    { name: 'unrelated', mutate: ({ repository }) => { repository.closingPullRequests = []; } },
    { name: 'dispatch marker missing', mutate: ({ repository }) => { repository.comments = []; } },
    { name: 'closed Issue', mutate: ({ repository }) => { repository.issue.state = 'closed'; } },
    { name: 'done', mutate: ({ project }) => { project.status = 'Done'; } },
    { name: 'cancelled', mutate: ({ project }) => { project.status = 'Cancelled'; } },
  ];

  for (const candidate of cases) {
    const context = setup();
    candidate.mutate?.(context);
    const before = context.project.status;
    await context.handlers.handleCancel(candidate.event ?? cancelEvent());
    assert.equal(context.project.status, before, candidate.name);
    assert.equal(context.project.transitions.length, 0, candidate.name);
  }
});

test('cancel mutation直前のlatest actor/status再読でstale eventを停止しredeliveryは一度だけ遷移する', async () => {
  const racing = setup();
  let actorReads = 0;
  racing.repository.getLatestLabelActor = async () => {
    actorReads += 1;
    return actorReads === 1 ? 'yuto90' : 'attacker';
  };
  await racing.handlers.handleCancel(cancelEvent());
  assert.equal(racing.project.transitions.length, 0);

  const delivered = setup();
  await delivered.handlers.handleCancel(cancelEvent());
  await delivered.handlers.handleCancel(cancelEvent());
  assert.equal(delivered.project.transitions.length, 1);
  assert.equal(delivered.project.status, 'Cancelled');
});

test('Cancelled後は全public handlerがcomment/label/status/itemを一切変更しない', async () => {
  const { repository, project, handlers } = setup();
  await handlers.handleCancel(cancelEvent());
  repository.issue.labels.push('agent-ready');
  repository.mutations = [];
  project.transitions = [];
  project.ensureCalls = 0;

  const workflowRelation = {
    id: 1030, number: 30, url: 'https://api.github.com/repos/octo-org/widgets/pulls/30',
    head: { ref: 'cursor/issue-20-task', sha: 'abcdef', repo: { id: 100, url: 'https://api.github.com/repos/octo-org/widgets', name: 'widgets' } },
    base: { ref: 'main', sha: 'beef', repo: { id: 100, url: 'https://api.github.com/repos/octo-org/widgets', name: 'widgets' } },
  };
  const workflowRun = { id: 7, name: 'Pull Request CI', status: 'completed', conclusion: 'failure', head_sha: 'abcdef', repository: { id: 100, full_name: 'octo-org/widgets' }, pull_requests: [workflowRelation] };
  const events = [
    handlers.handleStart({ action: 'opened', repository: { full_name: 'octo-org/widgets' }, issue: { number: 20 } }),
    handlers.handleStart({ action: 'labeled', repository: { full_name: 'octo-org/widgets' }, issue: { number: 20 }, label: { name: 'agent-ready' } }),
    handlers.handlePrCreated({ action: 'opened', repository: { full_name: 'octo-org/widgets' }, number: 30, pull_request: { number: 30 } }),
    handlers.handleComment({ action: 'created', repository: { full_name: 'octo-org/widgets' }, issue: { number: 30, pull_request: {} }, comment: { user: { login: 'yuto90' }, body: '@cursor' } }),
    handlers.handleCi({ action: 'completed', repository: { full_name: 'octo-org/widgets' }, workflow_run: workflowRun }),
    handlers.handleReview({ action: 'submitted', repository: { full_name: 'octo-org/widgets' }, pull_request: { number: 30 }, review: { user: { login: 'yuto90' }, state: 'changes_requested', commit_id: 'abcdef', submitted_at: '2026-08-24T00:00:00Z' } }),
    handlers.handleMerge({ action: 'closed', repository: { full_name: 'octo-org/widgets' }, pull_request: { number: 30 } }),
  ];
  await Promise.all(events);

  assert.equal(project.ensureCalls, 0);
  assert.deepEqual(project.transitions, []);
  assert.deepEqual(repository.mutations, []);
  assert.equal(project.status, 'Cancelled');
});
