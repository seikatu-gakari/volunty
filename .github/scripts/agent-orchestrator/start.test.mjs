import assert from 'node:assert/strict';
import test from 'node:test';

import { createHandlers } from './handlers.mjs';

const config = {
  owner: 'octo-org', repository: 'widgets', operator: 'yuto90',
  labels: { ready: 'agent-ready', cancel: 'agent-cancel' },
  defaultBranch: 'main', cursorBranchPrefix: 'cursor/',
};

function issue(number, { id = number + 100, state = 'open', labels = [], title = '安全な題名' } = {}) {
  return { id, number, state, labels, title };
}

class FakeRepository {
  constructor(issues) {
    this.issues = new Map(issues.map((entry) => [entry.number, entry]));
    this.comments = new Map();
    this.dependencies = new Map();
    this.blockedBy = new Map();
    this.readyActors = new Map();
    this.closingPullRequests = new Map();
  }
  async getIssue(number) { return structuredClone(this.issues.get(number)); }
  async getLatestLabelActor(number) { return this.readyActors.get(number) ?? null; }
  async listIssueDependencies(number) { return structuredClone(this.dependencies.get(number) ?? []); }
  async listBlockedBy(number) { return structuredClone(this.blockedBy.get(number) ?? []); }
  async findClosingPullRequests(number) { return structuredClone(this.closingPullRequests.get(number) ?? []); }
  async listComments(number) { return structuredClone(this.comments.get(number) ?? []); }
  async postComment(number, body) { this.comments.set(number, [...(this.comments.get(number) ?? []), { body }]); }
}

class FakeProject {
  constructor() { this.items = new Map(); }
  async resolveProject() { return { projectId: 1, statusFieldId: 2, optionIdsByName: { Backlog: 'b' } }; }
  async ensureIssueItem(id) { if (!this.items.has(id)) this.items.set(id, null); }
  async getIssueStatus(id) { return this.items.get(id) ?? null; }
  async transitionIssue(id, target, allowedFrom) {
    const current = this.items.get(id) ?? null;
    if (current === target) return 'unchanged';
    if (!allowedFrom.includes(current)) throw new Error('stale project status');
    this.items.set(id, target);
    return 'changed';
  }
}

function handlersFor(repository, project = new FakeProject()) {
  return { handlers: createHandlers({ repository, project, config, summary: { add() {} } }), project };
}

test('opened IssueはREST idのProject itemをBacklogへ初期化する', async () => {
  const repository = new FakeRepository([issue(7)]);
  const { handlers, project } = handlersFor(repository);

  await handlers.handleStart({ action: 'opened', issue: { number: 7 }, repository: { owner: { login: 'octo-org' }, name: 'widgets' } });

  assert.equal(project.items.get(107), 'Backlog');
});

test('operatorのagent-readyとclosed dependencyは一度だけCursorをdispatchする', async () => {
  const repository = new FakeRepository([issue(8, { labels: ['agent-ready'] })]);
  repository.readyActors.set(8, 'yuto90');
  repository.dependencies.set(8, [issue(3, { state: 'closed' })]);
  const project = new FakeProject();
  project.items.set(108, 'Backlog');
  const { handlers } = handlersFor(repository, project);
  const event = { action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 8 }, repository: { full_name: 'octo-org/widgets' } };

  await handlers.handleStart(event);
  await handlers.handleStart(event);

  const comments = await repository.listComments(8);
  assert.equal(comments.length, 1);
  assert.match(comments[0].body, /<!-- agent:dispatch:v1 issue=8 -->/);
  assert.match(comments[0].body, /(^|\n)@cursor(\n|$)/);
  assert.match(comments[0].body, /cursor\/issue-8-safe/);
  assert.match(comments[0].body, /Fixes #8/);
  assert.match(comments[0].body, /Human Input/);
  assert.match(comments[0].body, /gh pr ready/);
  assert.deepEqual(repository.issues.get(8).labels, ['agent-ready']);
});

test('Backlog未初期化のIssueはagent-readyを残してdispatchしない', async () => {
  const repository = new FakeRepository([issue(15, { labels: ['agent-ready'] })]);
  repository.readyActors.set(15, 'yuto90');
  const { handlers } = handlersFor(repository);

  await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 15 }, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(await repository.listComments(15), []);
  assert.deepEqual(repository.issues.get(15).labels, ['agent-ready']);
});

test('open dependencyまたは最新label actor不正ならlabelを残してdispatchしない', async () => {
  for (const [number, actor, dependencies] of [
    [9, 'yuto90', [issue(4, { state: 'open' })]],
    [10, 'someone-else', []],
  ]) {
    const repository = new FakeRepository([issue(number, { labels: ['agent-ready'] })]);
    repository.readyActors.set(number, actor);
    repository.dependencies.set(number, dependencies);
    const { handlers } = handlersFor(repository);

    await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number }, repository: { full_name: 'octo-org/widgets' } });

    assert.deepEqual(await repository.listComments(number), [], `Issue #${number}`);
    assert.deepEqual(repository.issues.get(number).labels, ['agent-ready'], `Issue #${number}`);
  }
});

test('closed eventは直接blockedでopenかつreadyのIssueだけを再評価する', async () => {
  const repository = new FakeRepository([
    issue(11, { state: 'closed' }),
    issue(12, { labels: ['agent-ready'] }),
    issue(13, { labels: ['agent-ready'], state: 'closed' }),
  ]);
  repository.blockedBy.set(11, [issue(12, { labels: ['agent-ready'] }), issue(13, { labels: ['agent-ready'], state: 'closed' })]);
  repository.readyActors.set(12, 'yuto90');
  repository.readyActors.set(13, 'yuto90');
  const project = new FakeProject();
  project.items.set(112, 'Backlog');
  const { handlers } = handlersFor(repository, project);

  await handlers.handleStart({ action: 'closed', issue: { number: 11 }, repository: { full_name: 'octo-org/widgets' } });

  assert.equal((await repository.listComments(12)).length, 1);
  assert.deepEqual(await repository.listComments(13), []);
});

test('workflow_dispatch preflightはread-onlyでProjectを解決する', async () => {
  const repository = new FakeRepository([issue(14, { labels: ['agent-ready'] })]);
  const { handlers, project } = handlersFor(repository);

  await handlers.handleStart({ action: 'workflow_dispatch', repository: { full_name: 'octo-org/widgets' } });

  assert.equal(project.items.size, 0);
  assert.deepEqual(await repository.listComments(14), []);
});
