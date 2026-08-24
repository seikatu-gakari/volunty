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

function event({ action = 'workflow_dispatch', actor = 'yuto90', number = 30 } = {}) {
  return {
    action,
    repository: { full_name: 'octo-org/widgets' },
    sender: { login: actor },
    pull_request: { number },
  };
}

test('operatorのmanual workflow_dispatchはAPI上の一意な最新changes_requestedでHuman ReviewをReworkへ移す', async () => {
  const { handlers, project } = setup();
  const result = await handlers.handleReview(event());
  assert.deepEqual(result, { kind: 'transition', status: 'Rework' });
  assert.equal(project.status, 'Rework');
  assert.deepEqual(project.transitions, [{ id: 120, target: 'Rework', allowedFrom: ['Human Review'] }]);
});

test('unauthorized dispatch・対象外event・ordinary/non-managed PRはskipでAPI mutationしない', async () => {
  const cases = [
    { name: 'unauthorized', event: event({ actor: 'collaborator' }), reason: 'unauthorized-operator' },
    { name: 'wrong event', event: event({ action: 'pull_request_review' }), reason: 'unsupported-event' },
    { name: 'ordinary branch', mutate: ({ repository }) => { repository.pr.head.ref = 'human/fix'; }, event: event(), reason: 'not-managed-pr' },
    { name: 'fork PR', mutate: ({ repository }) => { repository.pr.head.repository.owner = 'attacker'; }, event: event(), reason: 'not-managed-pr' },
    { name: 'closed PR', mutate: ({ repository }) => { repository.pr.state = 'closed'; }, event: event(), reason: 'not-managed-pr' },
    { name: 'missing closing issue', mutate: ({ repository }) => { repository.findClosingIssues = async () => []; }, event: event(), reason: 'invalid-closing-issues' },
  ];
  for (const candidate of cases) {
    const context = setup();
    candidate.mutate?.(context);
    const result = await context.handlers.handleReview(candidate.event);
    assert.deepEqual(result, { kind: 'skip', reason: candidate.reason }, candidate.name);
    assert.equal(context.project.status, 'Human Review', candidate.name);
    assert.equal(context.project.transitions.length, 0, candidate.name);
  }
});

test('latest readyより後のcurrent-head operator reviewだけを使い、状態・時系列・一意性をfail closedにする', async () => {
  const cases = [
    { name: 'approved only', mutate: (repository) => { repository.reviews[0].state = 'approved'; }, reason: 'review-not-changes-requested' },
    { name: 'commented only', mutate: (repository) => { repository.reviews[0].state = 'commented'; }, reason: 'review-not-changes-requested' },
    { name: 'other author', mutate: (repository) => { repository.reviews[0].author = 'attacker'; }, reason: 'review-evidence-missing' },
    { name: 'stale head', mutate: (repository) => { repository.reviews[0].commitId = 'deadbeef'; }, reason: 'review-evidence-missing' },
    { name: 'missing timestamp', mutate: (repository) => { repository.reviews[0].submittedAt = null; }, reason: 'invalid-review-evidence' },
    { name: 'same as ready', mutate: (repository) => { repository.reviews[0].submittedAt = readyAt; }, reason: 'stale-review' },
    { name: 'before ready', mutate: (repository) => { repository.reviews[0].submittedAt = readyAt - 1; }, reason: 'stale-review' },
    { name: 'missing ready', mutate: (repository) => { repository.comments = repository.comments.slice(0, 1); }, reason: 'ready-marker-missing' },
    {
      name: 'ambiguous latest tie',
      mutate: (repository) => { repository.reviews.push({ id: 102, author: 'yuto90', state: 'changes_requested', submittedAt, commitId: 'abcdef' }); },
      reason: 'ambiguous-review-evidence',
    },
    {
      name: 'newer approval supersedes changes request',
      mutate: (repository) => { repository.reviews.push({ id: 102, author: 'yuto90', state: 'approved', submittedAt: submittedAt + 1, commitId: 'abcdef' }); },
      reason: 'review-not-changes-requested',
    },
  ];
  for (const candidate of cases) {
    const { repository, project, handlers } = setup();
    candidate.mutate(repository);
    const result = await handlers.handleReview(event());
    assert.deepEqual(result, { kind: 'skip', reason: candidate.reason }, candidate.name);
    assert.equal(project.status, 'Human Review', candidate.name);
    assert.equal(project.transitions.length, 0, candidate.name);
  }
});

test('wrong statusとterminalはmanual reconciliationで遷移しない', async () => {
  for (const { status, expectedReason } of [
    { status: 'In Progress', expectedReason: 'invalid-status' },
    { status: 'Rework', expectedReason: 'invalid-status' },
    { status: 'Done', expectedReason: 'terminal' },
    { status: 'Cancelled', expectedReason: 'terminal' },
  ]) {
    const { project, handlers } = setup();
    project.status = status;
    const result = await handlers.handleReview(event());
    assert.deepEqual(result, { kind: 'skip', reason: expectedReason }, status);
    assert.equal(project.transitions.length, 0, status);
  }
});

test('mutation直前のAPI二重再取得でreview/head/status raceを停止する', async () => {
  for (const race of ['review', 'head', 'status']) {
    const context = setup();
    let reads = 0;
    const original = context.repository.getCurrentPullRequest.bind(context.repository);
    context.repository.getCurrentPullRequest = async () => {
      reads += 1;
      if (reads === 2) {
        if (race === 'review') context.repository.reviews[0].state = 'dismissed';
        if (race === 'head') context.repository.pr.head.sha = 'fedcba';
        if (race === 'status') context.project.status = 'In Progress';
      }
      return original();
    };
    const result = await context.handlers.handleReview(event());
    assert.notDeepEqual(result, { kind: 'transition', status: 'Rework' }, race);
    assert.equal(context.project.transitions.length, 0, race);
    assert.equal(reads, 2, race);
  }
});

test('manual reconciliationのredeliveryは一度だけ遷移する', async () => {
  const { handlers, project } = setup();
  await handlers.handleReview(event());
  const replay = await handlers.handleReview(event());
  assert.deepEqual(replay, { kind: 'skip', reason: 'invalid-status' });
  assert.equal(project.transitions.length, 1);
  assert.equal(project.status, 'Rework');
});
