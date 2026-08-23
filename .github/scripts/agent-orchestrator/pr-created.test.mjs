import assert from 'node:assert/strict';
import test from 'node:test';

import { createHandlers } from './handlers.mjs';

const config = {
  owner: 'octo-org', repository: 'widgets', operator: 'yuto90',
  labels: { ready: 'agent-ready', cancel: 'agent-cancel' },
  defaultBranch: 'main', cursorBranchPrefix: 'cursor/',
};
const marker = '<!-- agent:dispatch:v1 issue=20 -->';

class FakeRepository {
  constructor() {
    this.issue = { id: 120, number: 20, state: 'open', labels: ['agent-ready'], title: 'Task' };
    this.pull = { number: 30, state: 'open', draft: true, base: { ref: 'main' }, head: { ref: 'cursor/issue-20-task' } };
    this.comments = [{ body: marker, author: 'yuto90' }];
    this.closingIssues = [this.issue];
  }
  async getPullRequest() { return structuredClone(this.pull); }
  async findClosingIssues() { return structuredClone(this.closingIssues); }
  async getIssue() { return structuredClone(this.issue); }
  async listComments() { return structuredClone(this.comments); }
  async removeLabel(_number, label) {
    this.issue.labels = this.issue.labels.filter((entry) => entry !== label);
    if (this.cancelDuringRemoval) this.issue.labels.push('agent-cancel');
  }
}
class FakeProject {
  constructor() { this.status = 'Backlog'; }
  async getIssueStatus() { return this.status; }
  async transitionIssue(_id, target, allowedFrom) {
    if (this.status === target) return 'unchanged';
    if (!allowedFrom.includes(this.status)) throw new Error('stale');
    this.status = target;
    if (this.cancelDuringTransition) this.repository.issue.labels.push('agent-cancel');
    return 'changed';
  }
}

function setup() {
  const repository = new FakeRepository();
  const project = new FakeProject();
  project.repository = repository;
  const handlers = createHandlers({ repository, project, config, summary: { add() {} } });
  return { repository, project, handlers };
}

test('Draft cursor PRの唯一の同一repo closing IssueをACKしてreadyを除去しIn Progressへ進める', async () => {
  const { repository, project, handlers } = setup();

  await handlers.handlePrCreated({ action: 'opened', number: 30, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(repository.issue.labels, []);
  assert.equal(project.status, 'In Progress');
});

test('ACK条件に一致しないPRはIssue labelとStatusを変えない', async () => {
  for (const mutate of [
    (state) => { state.repository.pull.state = 'closed'; },
    (state) => { state.repository.pull.draft = false; },
    (state) => { state.repository.pull.base.ref = 'release'; },
    (state) => { state.repository.comments = []; },
    (state) => { state.repository.closingIssues = [state.repository.issue, { ...state.repository.issue, id: 121, number: 21 }]; },
  ]) {
    const state = setup();
    mutate(state);

    await state.handlers.handlePrCreated({ action: 'opened', number: 30, repository: { full_name: 'octo-org/widgets' } });

    assert.deepEqual(state.repository.issue.labels, ['agent-ready']);
    assert.equal(state.project.status, 'Backlog');
  }
});

test('closed Draft PRはliteralなpr-not-open理由でACKしない', async () => {
  const { repository, project, handlers } = setup();
  repository.pull.state = 'closed';

  const result = await handlers.handlePrCreated({ action: 'opened', number: 30, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(result, { kind: 'skip', reason: 'pr-not-open' });
  assert.deepEqual(repository.issue.labels, ['agent-ready']);
  assert.equal(project.status, 'Backlog');
});

test('他者のdispatch markerだけではDraft PR ACKをしない', async () => {
  const { repository, project, handlers } = setup();
  repository.comments = [{ body: marker, author: 'attacker' }];

  const result = await handlers.handlePrCreated({ action: 'opened', number: 30, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(result, { kind: 'skip', reason: 'dispatch-marker-missing' });
  assert.deepEqual(repository.issue.labels, ['agent-ready']);
  assert.equal(project.status, 'Backlog');
});

test('Status遷移成功後のredeliveryはlabel removalを完遂する', async () => {
  const { repository, project, handlers } = setup();
  project.status = 'In Progress';

  await handlers.handlePrCreated({ action: 'opened', number: 30, repository: { full_name: 'octo-org/widgets' } });

  assert.deepEqual(repository.issue.labels, []);
  assert.equal(project.status, 'In Progress');
});

test('label除去後にcancelされたpartial ACKはIn Progressへ遷移せず失敗として残す', async () => {
  const { repository, project, handlers } = setup();
  project.cancelDuringTransition = true;

  await assert.rejects(
    () => handlers.handlePrCreated({ action: 'opened', number: 30, repository: { full_name: 'octo-org/widgets' } }),
    /partially mutated/,
  );

  assert.deepEqual(repository.issue.labels, ['agent-ready', 'agent-cancel']);
  assert.equal(project.status, 'In Progress');
});

test('label除去中のcancel raceは完了扱いにせず後続mutationを行わない', async () => {
  const { repository, project, handlers } = setup();
  repository.cancelDuringRemoval = true;

  await assert.rejects(
    () => handlers.handlePrCreated({ action: 'opened', number: 30, repository: { full_name: 'octo-org/widgets' } }),
    /partially mutated/,
  );

  assert.deepEqual(repository.issue.labels, ['agent-cancel']);
  assert.equal(project.status, 'In Progress');
});
