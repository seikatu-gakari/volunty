import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateCancel,
  evaluateDone,
  evaluateHumanReview,
  evaluatePrAck,
  evaluateReview,
  evaluateStart,
  hasExactMarker,
  hasStandaloneCursorMention,
  isTerminalStatus,
  parseReadyHeadSha,
  parseRetryMarker,
} from './core.mjs';

test('terminal stateはDoneとCancelledだけである', () => {
  assert.equal(isTerminalStatus('Done'), true);
  assert.equal(isTerminalStatus('Cancelled'), true);
  assert.equal(isTerminalStatus('Blocked'), false);
});

test('fixed markerだけを厳密に認識する', () => {
  assert.equal(hasExactMarker('回答\n<!-- agent:human-input -->', '<!-- agent:human-input -->'), true);
  assert.equal(hasExactMarker('<!-- agent:human-input reason=deploy -->', '<!-- agent:human-input -->'), false);
});

test('standalone @cursorだけを人間の再開命令として認識する', () => {
  assert.equal(hasStandaloneCursorMention('@cursor\n再開してください'), true);
  assert.equal(hasStandaloneCursorMention('mail@cursor.example'), false);
  assert.equal(hasStandaloneCursorMention('@cursor-bot'), false);
});

test('ready markerからcurrent head SHAを取得する', () => {
  const body = '<!-- agent:ready-for-review -->\n<!-- agent:ready-for-review:v1 head_sha=abc123 -->';
  assert.equal(parseReadyHeadSha(body), 'abc123');
  assert.equal(parseReadyHeadSha('<!-- agent:ready-for-review:v1 head_sha=abc123 -->'), null);
});

test('CI retry markerを厳密にparseする', () => {
  assert.deepEqual(
    parseRetryMarker('<!-- agent:ci-retry:v1 run_id=42 head_sha=abc retry=3 -->'),
    { runId: '42', headSha: 'abc', retry: 3 },
  );
  assert.equal(parseRetryMarker('<!-- agent:ci-retry:v1 run_id=42 retry=3 head_sha=abc -->'), null);
});

test('startはoperator、dependency、dispatch markerとterminal stateをguardする', () => {
  const context = {
    isOperator: true,
    isOpen: true,
    hasReadyLabel: true,
    hasCancelLabel: false,
    status: 'Backlog',
    hasOpenDependencies: false,
    hasDispatchMarker: false,
    hasManagedPullRequest: false,
  };
  const cases = [
    { name: '開始可能', changes: {}, want: { kind: 'dispatch' } },
    { name: 'operator違反', changes: { isOperator: false }, want: { kind: 'skip', reason: 'unauthorized-operator' } },
    { name: 'open dependency', changes: { hasOpenDependencies: true }, want: { kind: 'skip', reason: 'open-dependencies' } },
    { name: 'dispatch済み', changes: { hasDispatchMarker: true }, want: { kind: 'skip', reason: 'already-dispatched' } },
    { name: 'terminal state', changes: { status: 'Done' }, want: { kind: 'skip', reason: 'terminal' } },
  ];

  for (const { name, changes, want } of cases) {
    assert.deepEqual(evaluateStart({ ...context, ...changes }), want, name);
  }
});

test('Draft PR ACKは管理対象のDraft PRだけをIn Progressへ移す', () => {
  const context = {
    status: 'Backlog',
    isOpen: true,
    isDraft: true,
    isDefaultBranch: true,
    hasCursorBranch: true,
    closingIssueCount: 1,
    hasReadyLabel: true,
    hasDispatchMarker: true,
    cancelled: false,
  };
  const cases = [
    { name: 'ACK', changes: {}, want: { kind: 'transition', status: 'In Progress' } },
    { name: 'non-Draft', changes: { isDraft: false }, want: { kind: 'skip', reason: 'pr-not-draft' } },
    { name: '複数Issue', changes: { closingIssueCount: 2 }, want: { kind: 'skip', reason: 'invalid-closing-issues' } },
    { name: 'terminal', changes: { status: 'Cancelled' }, want: { kind: 'skip', reason: 'terminal' } },
  ];

  for (const { name, changes, want } of cases) {
    assert.deepEqual(evaluatePrAck({ ...context, ...changes }), want, name);
  }
});

test('Human Review gateはready markerとCIの到着順に依存しない', () => {
  const context = {
    status: 'In Progress',
    isDraft: false,
    isOpen: true,
    headSha: 'current-head',
    latestReady: { headSha: 'current-head', createdAt: 20 },
    invalidatedAfter: 10,
    ciConclusion: 'success',
    cancelled: false,
  };
  const cases = [
    { name: 'ready marker後のCI success', changes: { trigger: 'ci' }, want: { kind: 'transition', status: 'Human Review' } },
    { name: 'CI success後のready marker', changes: { trigger: 'ready' }, want: { kind: 'transition', status: 'Human Review' } },
    { name: 'stale SHA', changes: { latestReady: { headSha: 'old-head', createdAt: 20 } }, want: { kind: 'skip', reason: 'stale-ready-marker' } },
    { name: '無効化済みmarker', changes: { invalidatedAfter: 20 }, want: { kind: 'skip', reason: 'invalidated-ready-marker' } },
    { name: 'CI未成功', changes: { ciConclusion: 'failure' }, want: { kind: 'skip', reason: 'ci-not-green' } },
  ];

  for (const { name, changes, want } of cases) {
    assert.deepEqual(evaluateHumanReview({ ...context, ...changes }), want, name);
  }
});

test('reviewはoperatorのchanges requestedだけをReworkへ移す', () => {
  const context = {
    status: 'Human Review',
    isOperator: true,
    reviewState: 'changes_requested',
    cancelled: false,
  };
  const cases = [
    { name: 'changes requested', changes: {}, want: { kind: 'transition', status: 'Rework' } },
    { name: 'unauthorized review', changes: { isOperator: false }, want: { kind: 'skip', reason: 'unauthorized-review' } },
    { name: 'approve', changes: { reviewState: 'approved' }, want: { kind: 'skip', reason: 'review-not-changes-requested' } },
    { name: 'terminal', changes: { status: 'Done' }, want: { kind: 'skip', reason: 'terminal' } },
  ];

  for (const { name, changes, want } of cases) {
    assert.deepEqual(evaluateReview({ ...context, ...changes }), want, name);
  }
});

test('Doneはdefault branchへのmergeとIssue closeの両方を要求する', () => {
  const context = {
    status: 'Human Review',
    isMerged: true,
    isIssueClosed: true,
    isDefaultBranch: true,
    cancelled: false,
  };
  const cases = [
    { name: 'merged+closed', changes: {}, want: { kind: 'transition', status: 'Done' } },
    { name: 'unmerged close', changes: { isMerged: false }, want: { kind: 'skip', reason: 'pr-not-merged' } },
    { name: 'other base', changes: { isDefaultBranch: false }, want: { kind: 'skip', reason: 'invalid-base' } },
    { name: 'open Issue', changes: { isIssueClosed: false }, want: { kind: 'skip', reason: 'issue-not-closed' } },
  ];

  for (const { name, changes, want } of cases) {
    assert.deepEqual(evaluateDone({ ...context, ...changes }), want, name);
  }
});

test('cancelはoperatorによる管理対象Issueへのlabelだけを受け入れる', () => {
  const context = {
    status: 'In Progress',
    isOperator: true,
    hasCancelLabel: true,
    isManaged: true,
    hasReadyLabel: false,
  };
  const cases = [
    { name: 'cancel', changes: {}, want: { kind: 'transition', status: 'Cancelled' } },
    { name: 'unauthorized', changes: { isOperator: false }, want: { kind: 'skip', reason: 'unauthorized-operator' } },
    { name: 'unmanaged', changes: { isManaged: false }, want: { kind: 'skip', reason: 'not-managed' } },
    { name: 'terminal', changes: { status: 'Cancelled' }, want: { kind: 'skip', reason: 'terminal' } },
  ];

  for (const { name, changes, want } of cases) {
    assert.deepEqual(evaluateCancel({ ...context, ...changes }), want, name);
  }
});
