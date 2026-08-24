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
    this.pr = { number: 30, state: 'closed', merged: true, base: { ref: 'main' }, head: { ref: 'cursor/issue-20-task', repository: { owner: 'octo-org', name: 'widgets' } } };
    this.closingIssues = [{ id: 'I_20', number: 20, state: 'closed' }];
    this.closingPullRequests = [{ id: 'P_30', number: 30, state: 'merged', isDraft: false, baseRefName: 'main', headRefName: 'cursor/issue-20-task', headRepository: { owner: 'octo-org', name: 'widgets' } }];
    this.comments = [{ id: 1, author: 'yuto90', body: '<!-- agent:dispatch:v1 issue=20 -->', createdAt: 1 }];
  }
  async getIssue() { return structuredClone(this.issue); }
  async getCompletionPullRequest() { return structuredClone(this.pr); }
  async findClosingIssues() { return structuredClone(this.closingIssues); }
  async findClosingPullRequests() { return structuredClone(this.closingPullRequests); }
  async listComments() { return structuredClone(this.comments); }
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

function prEvent() { return { action: 'closed', repository: { full_name: 'octo-org/widgets' }, pull_request: { number: 30 } }; }
function issueEvent() { return { action: 'closed', repository: { full_name: 'octo-org/widgets' }, issue: { number: 20 } }; }

test('PR mergeが先でも後続Issue close eventでDoneへ収束する', async () => {
  const { repository, project, handlers } = setup();
  repository.issue.state = 'open';
  repository.closingIssues[0].state = 'open';

  assert.deepEqual(await handlers.handleMerge(prEvent()), { kind: 'skip', reason: 'issue-not-closed' });
  repository.issue.state = 'closed';
  repository.closingIssues[0].state = 'closed';
  const result = await handlers.handleMerge(issueEvent());

  assert.deepEqual(result, { kind: 'transition', status: 'Done' });
  assert.equal(project.status, 'Done');
  assert.equal(project.transitions.length, 1);
});

test('Issue closeが先でも後続PR merged eventでDoneへ収束する', async () => {
  const { repository, project, handlers } = setup();
  repository.issue.state = 'closed';
  repository.pr.merged = false;
  repository.closingPullRequests[0].state = 'closed';

  assert.deepEqual(await handlers.handleMerge(issueEvent()), { kind: 'skip', reason: 'no-qualifying-pull-request' });
  repository.pr.merged = true;
  repository.closingPullRequests[0].state = 'merged';
  const result = await handlers.handleMerge(prEvent());

  assert.deepEqual(result, { kind: 'transition', status: 'Done' });
  assert.equal(project.status, 'Done');
  assert.equal(project.transitions.length, 1);
});

test('unmerged・other base・manual close/no relation・open Issue・unmanaged relation・terminalはDoneへ移さない', async () => {
  const cases = [
    { name: 'unmerged', mutate: ({ repository }) => { repository.pr.merged = false; repository.closingPullRequests[0].state = 'closed'; } },
    { name: 'other base', mutate: ({ repository }) => { repository.pr.base.ref = 'release'; repository.closingPullRequests[0].baseRefName = 'release'; } },
    { name: 'manual close', mutate: ({ repository }) => { repository.closingPullRequests = []; repository.closingIssues = []; } },
    { name: 'open Issue', mutate: ({ repository }) => { repository.issue.state = 'open'; repository.closingIssues[0].state = 'open'; } },
    { name: 'unmanaged relation', mutate: ({ repository }) => { repository.closingPullRequests[0].headRepository.owner = 'fork-owner'; } },
    { name: 'dispatch marker missing', mutate: ({ repository }) => { repository.comments = []; } },
    { name: 'unset status', mutate: ({ project }) => { project.status = null; } },
    { name: 'done', mutate: ({ project }) => { project.status = 'Done'; } },
    { name: 'cancelled', mutate: ({ project }) => { project.status = 'Cancelled'; } },
  ];

  for (const candidate of cases) {
    const context = setup();
    context.repository.issue.state = 'closed';
    candidate.mutate(context);
    const before = context.project.status;
    await context.handlers.handleMerge(issueEvent());
    assert.equal(context.project.status, before, candidate.name);
    assert.equal(context.project.transitions.length, 0, candidate.name);
  }
});

test('Done mutation直前のIssue/status再読でraceを停止しredeliveryは一度だけ遷移する', async () => {
  const racing = setup();
  racing.repository.issue.state = 'closed';
  let reads = 0;
  const original = racing.repository.getIssue.bind(racing.repository);
  racing.repository.getIssue = async () => {
    reads += 1;
    if (reads === 2) racing.project.status = 'Cancelled';
    return original();
  };
  await racing.handlers.handleMerge(prEvent());
  assert.equal(racing.project.transitions.length, 0);
  assert.equal(racing.project.status, 'Cancelled');

  const delivered = setup();
  delivered.repository.issue.state = 'closed';
  await delivered.handlers.handleMerge(prEvent());
  await delivered.handlers.handleMerge(prEvent());
  assert.equal(delivered.project.transitions.length, 1);
  assert.equal(delivered.project.status, 'Done');
});
