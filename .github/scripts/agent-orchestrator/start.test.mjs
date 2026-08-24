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
  async postComment(number, body) { this.comments.set(number, [...(this.comments.get(number) ?? []), { body, author: 'yuto90' }]); }
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

test('opened Issueは既存Statusを上書きしない', async () => {
  const repository = new FakeRepository([issue(17)]);
  const project = new FakeProject();
  project.items.set(117, 'Human Review');
  const { handlers } = handlersFor(repository, project);

  await handlers.handleStart({ action: 'opened', issue: { number: 17 }, repository: { full_name: 'octo-org/widgets' } });

  assert.equal(project.items.get(117), 'Human Review');
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
  const verificationIndex = comments[0].body.indexOf('lint / UT / build');
  const readyIndex = comments[0].body.indexOf('gh pr ready');
  const markerIndex = comments[0].body.indexOf('<!-- agent:ready-for-review -->');
  const shaMarkerIndex = comments[0].body.indexOf('<!-- agent:ready-for-review:v1 head_sha=... -->');
  assert.ok(verificationIndex >= 0 && verificationIndex < readyIndex);
  assert.ok(readyIndex < markerIndex && markerIndex < shaMarkerIndex);
  assert.equal(project.items.get(108), 'Backlog');
  assert.deepEqual(repository.issues.get(8).labels, ['agent-ready']);
});

test('unset StatusのIssueはguard通過後にBacklog初期化してdispatchする', async () => {
  const repository = new FakeRepository([issue(15, { labels: ['agent-ready'] })]);
  repository.readyActors.set(15, 'yuto90');
  const { handlers, project } = handlersFor(repository);

  await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 15 }, repository: { full_name: 'octo-org/widgets' } });

  assert.equal((await repository.listComments(15)).length, 1);
  assert.equal((await handlers.handleStart({ action: 'labeled', label: { name: 'other-label' }, issue: { number: 15 }, repository: { full_name: 'octo-org/widgets' } })).reason, 'unrelated-label');
  assert.equal(project.items.get(115), 'Backlog');
  assert.deepEqual(repository.issues.get(15).labels, ['agent-ready']);
});

test('他者が投稿したdispatch markerはdispatch済みとして信頼しない', async () => {
  const repository = new FakeRepository([issue(16, { labels: ['agent-ready'] })]);
  repository.readyActors.set(16, 'yuto90');
  repository.comments.set(16, [{ body: '<!-- agent:dispatch:v1 issue=16 -->', author: 'attacker' }]);
  const project = new FakeProject();
  project.items.set(116, 'Backlog');
  const { handlers } = handlersFor(repository, project);

  await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 16 }, repository: { full_name: 'octo-org/widgets' } });

  assert.equal((await repository.listComments(16)).length, 2);
});

test('別Issueのdispatch marker bodyは対象Issueのdispatch済みを偽装しない', async () => {
  const repository = new FakeRepository([issue(20, { labels: ['agent-ready'] })]);
  repository.readyActors.set(20, 'yuto90');
  repository.comments.set(20, [{ body: '<!-- agent:dispatch:v1 issue=200 -->', author: 'yuto90' }]);
  const project = new FakeProject();
  project.items.set(120, 'Backlog');
  const { handlers } = handlersFor(repository, project);

  const result = await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 20 }, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(result, { kind: 'dispatch' });
  assert.equal((await repository.listComments(20)).length, 2);
});

test('human PRだけのreverse relationはmanaged PRとしてdispatchを妨害しない', async () => {
  const repository = new FakeRepository([issue(18, { labels: ['agent-ready'] })]);
  repository.readyActors.set(18, 'yuto90');
  repository.closingPullRequests.set(18, [{ state: 'open', baseRefName: 'main', headRefName: 'human/fix' }]);
  const project = new FakeProject();
  project.items.set(118, 'Backlog');
  const { handlers } = handlersFor(repository, project);

  await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 18 }, repository: { full_name: 'octo-org/widgets' } });

  assert.equal((await repository.listComments(18)).length, 1);
});

test('fork headのcursor PRはnonmanagedとしてdispatchを妨害しない', async () => {
  const repository = new FakeRepository([issue(21, { labels: ['agent-ready'] })]);
  repository.readyActors.set(21, 'yuto90');
  repository.closingPullRequests.set(21, [{
    state: 'open', baseRefName: 'main', headRefName: 'cursor/fork-fix',
    headRepository: { owner: 'fork-owner', name: 'widgets' },
  }]);
  const project = new FakeProject();
  project.items.set(121, 'Backlog');
  const { handlers } = handlersFor(repository, project);

  const result = await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 21 }, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(result, { kind: 'dispatch' });
  assert.equal((await repository.listComments(21)).length, 1);
});

test('closed・wrong base・非cursorのreverse PRだけではdispatchを妨害しない', async () => {
  const repository = new FakeRepository([issue(19, { labels: ['agent-ready'] })]);
  repository.readyActors.set(19, 'yuto90');
  repository.closingPullRequests.set(19, [
    { state: 'closed', baseRefName: 'main', headRefName: 'cursor/old' },
    { state: 'open', baseRefName: 'release', headRefName: 'cursor/release' },
    { state: 'open', baseRefName: 'main', headRefName: 'human/fix' },
  ]);
  const project = new FakeProject();
  project.items.set(119, 'Backlog');
  const { handlers } = handlersFor(repository, project);

  const result = await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 19 }, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(result, { kind: 'dispatch' });
  assert.equal((await repository.listComments(19)).length, 1);
  assert.equal(project.items.get(119), 'Backlog');
});

test('open dependencyまたは最新label actor不正ならlabelを残してdispatchしない', async () => {
  for (const [number, actor, dependencies] of [
    [9, 'yuto90', [issue(4, { state: 'open' })]],
    [10, 'someone-else', []],
  ]) {
    const repository = new FakeRepository([issue(number, { labels: ['agent-ready'] })]);
    repository.readyActors.set(number, actor);
    repository.dependencies.set(number, dependencies);
    const { handlers, project } = handlersFor(repository);

    const result = await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number }, repository: { full_name: 'octo-org/widgets' } });

    assert.deepEqual(result, { kind: 'skip', reason: actor === 'yuto90' ? 'open-dependencies' : 'unauthorized-operator' }, `Issue #${number}`);
    assert.equal(project.items.size, 0, `Issue #${number}`);
    assert.deepEqual(await repository.listComments(number), [], `Issue #${number}`);
    assert.deepEqual(repository.issues.get(number).labels, ['agent-ready'], `Issue #${number}`);
  }
});

test('cancel labelのunset Statusは初期化もdispatchもしない', async () => {
  const repository = new FakeRepository([issue(22, { labels: ['agent-ready', 'agent-cancel'] })]);
  repository.readyActors.set(22, 'yuto90');
  const { handlers, project } = handlersFor(repository);

  const result = await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 22 }, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(result, { kind: 'skip', reason: 'terminal' });
  assert.equal(project.items.size, 0);
  assert.deepEqual(await repository.listComments(22), []);
});

test('unset Status初期化後の最終readがnullへ戻るraceはinvalid-statusでdispatchしない', async () => {
  const repository = new FakeRepository([issue(23, { labels: ['agent-ready'] })]);
  repository.readyActors.set(23, 'yuto90');
  const { handlers, project } = handlersFor(repository);
  let transitionCompleted = false;
  const originalTransition = project.transitionIssue.bind(project);
  const originalGetStatus = project.getIssueStatus.bind(project);
  project.transitionIssue = async (...args) => {
    const result = await originalTransition(...args);
    transitionCompleted = true;
    return result;
  };
  project.getIssueStatus = async (id) => {
    const status = await originalGetStatus(id);
    if (transitionCompleted && status === 'Backlog') {
      project.items.set(id, null);
      return null;
    }
    return status;
  };

  const result = await handlers.handleStart({ action: 'labeled', label: { name: 'agent-ready' }, issue: { number: 23 }, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(result, { kind: 'skip', reason: 'invalid-status' });
  assert.deepEqual(await repository.listComments(23), []);
  assert.equal(project.items.get(123), null);
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

test('raw workflow_dispatch payloadはtrusted eventNameだけでread-only preflightになる', async () => {
  const repository = new FakeRepository([issue(14, { labels: ['agent-ready'] })]);
  const { handlers, project } = handlersFor(repository);

  await handlers.handleStart({ repository: { full_name: 'octo-org/widgets' } }, { eventName: 'workflow_dispatch' });

  assert.equal(project.items.size, 0);
  assert.deepEqual(await repository.listComments(14), []);
});
