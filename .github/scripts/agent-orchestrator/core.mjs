const terminalStatuses = new Set(['Done', 'Cancelled']);

/**
 * @typedef {{kind: 'skip', reason: string} | {kind: 'transition', status: string} | {kind: 'dispatch'}} Decision
 */

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isTerminalStatus(status) {
  return terminalStatuses.has(status);
}

/**
 * @param {string | null | undefined} body
 * @param {string} marker
 * @returns {boolean}
 */
export function hasExactMarker(body, marker) {
  return typeof body === 'string' && body.includes(marker);
}

/**
 * @param {string | null | undefined} body
 * @returns {string | null}
 */
export function parseReadyHeadSha(body) {
  if (!hasExactMarker(body, '<!-- agent:ready-for-review -->')) {
    return null;
  }

  const match = body.match(/<!-- agent:ready-for-review:v1 head_sha=([0-9a-fA-F]+) -->/);
  return match?.[1] ?? null;
}

/**
 * @param {string | null | undefined} body
 * @returns {{runId: string, headSha: string, retry: number} | null}
 */
export function parseRetryMarker(body) {
  if (typeof body !== 'string') {
    return null;
  }

  const match = body.match(/<!-- agent:ci-retry:v1 run_id=([1-9][0-9]*) head_sha=([0-9a-fA-F]+) retry=([1-9][0-9]*) -->/);
  if (!match) {
    return null;
  }

  const retry = Number(match[3]);
  if (!Number.isSafeInteger(retry)) return null;
  return { runId: match[1], headSha: match[2], retry };
}

/**
 * @param {string | null | undefined} body
 * @returns {boolean}
 */
export function hasStandaloneCursorMention(body) {
  return typeof body === 'string' && /(^|[^\p{L}\p{N}_.+-])@cursor(?![\p{L}\p{N}_.+-])/u.test(body);
}

/** @param {string} reason @returns {Decision} */
function skip(reason) {
  return { kind: 'skip', reason };
}

/** @param {string} status @returns {Decision} */
function transition(status) {
  return { kind: 'transition', status };
}

/**
 * @param {{
 *   isOperator: boolean,
 *   isOpen: boolean,
 *   hasReadyLabel: boolean,
 *   hasCancelLabel: boolean,
 *   status: string | null | undefined,
 *   hasOpenDependencies: boolean,
 *   hasDispatchMarker: boolean,
 *   hasManagedPullRequest: boolean,
 * }} context
 * @returns {Decision}
 */
export function evaluateStart(context) {
  if (context.hasCancelLabel || isTerminalStatus(context.status)) return skip('terminal');
  if (!context.isOperator) return skip('unauthorized-operator');
  if (!context.isOpen) return skip('issue-not-open');
  if (!context.hasReadyLabel) return skip('ready-label-missing');
  if (context.status !== null && context.status !== undefined && context.status !== 'Backlog') return skip('invalid-status');
  if (context.hasOpenDependencies) return skip('open-dependencies');
  if (context.hasDispatchMarker) return skip('already-dispatched');
  if (context.hasManagedPullRequest) return skip('managed-pr-exists');
  return { kind: 'dispatch' };
}

/**
 * @param {{
 *   status: string | null | undefined,
 *   isOpen: boolean,
 *   isDraft: boolean,
 *   isDefaultBranch: boolean,
 *   hasCursorBranch: boolean,
 *   closingIssueCount: number,
 *   hasReadyLabel: boolean,
 *   hasDispatchMarker: boolean,
 *   cancelled: boolean,
 * }} context
 * @returns {Decision}
 */
export function evaluatePrAck(context) {
  if (context.cancelled || isTerminalStatus(context.status)) return skip('terminal');
  if (context.status !== 'Backlog') return skip('invalid-status');
  if (!context.isOpen) return skip('issue-not-open');
  if (!context.isDraft) return skip('pr-not-draft');
  if (!context.isDefaultBranch) return skip('invalid-base');
  if (!context.hasCursorBranch) return skip('invalid-branch');
  if (context.closingIssueCount !== 1) return skip('invalid-closing-issues');
  if (!context.hasReadyLabel) return skip('ready-label-missing');
  if (!context.hasDispatchMarker) return skip('dispatch-marker-missing');
  return transition('In Progress');
}

/**
 * @param {{
 *   status: string | null | undefined,
 *   isDraft: boolean,
 *   isOpen: boolean,
 *   headSha: string,
 *   latestReady: {headSha: string, createdAt: number} | null | undefined,
 *   invalidatedAfter: number,
 *   ciConclusion: string | null | undefined,
 *   cancelled: boolean,
 * }} context
 * @returns {Decision}
 */
export function evaluateHumanReview(context) {
  const { status, isDraft, isOpen, headSha, latestReady, invalidatedAfter, ciConclusion, cancelled } = context;

  if (cancelled || isTerminalStatus(status)) return skip('terminal');
  if (!['In Progress', 'Rework'].includes(status)) return skip('invalid-status');
  if (!isOpen || isDraft) return skip('pr-not-ready');
  if (ciConclusion !== 'success') return skip('ci-not-green');
  if (!latestReady || latestReady.headSha !== headSha) return skip('stale-ready-marker');
  if (latestReady.createdAt <= invalidatedAfter) return skip('invalidated-ready-marker');
  return transition('Human Review');
}

/**
 * @param {{
 *   status: string | null | undefined,
 *   isOperator: boolean,
 *   reviewState: string,
 *   cancelled: boolean,
 * }} context
 * @returns {Decision}
 */
export function evaluateReview(context) {
  if (context.cancelled || isTerminalStatus(context.status)) return skip('terminal');
  if (context.status !== 'Human Review') return skip('invalid-status');
  if (!context.isOperator) return skip('unauthorized-review');
  if (context.reviewState !== 'changes_requested') return skip('review-not-changes-requested');
  return transition('Rework');
}

/**
 * @param {{
 *   status: string | null | undefined,
 *   isMerged: boolean,
 *   isIssueClosed: boolean,
 *   isDefaultBranch: boolean,
 *   cancelled: boolean,
 * }} context
 * @returns {Decision}
 */
export function evaluateDone(context) {
  if (context.cancelled || isTerminalStatus(context.status)) return skip('terminal');
  if (!context.isMerged) return skip('pr-not-merged');
  if (!context.isDefaultBranch) return skip('invalid-base');
  if (!context.isIssueClosed) return skip('issue-not-closed');
  return transition('Done');
}

/**
 * @param {{
 *   status: string | null | undefined,
 *   isOperator: boolean,
 *   hasCancelLabel: boolean,
 *   isManaged: boolean,
 *   hasReadyLabel: boolean,
 * }} context
 * @returns {Decision}
 */
export function evaluateCancel(context) {
  if (isTerminalStatus(context.status)) return skip('terminal');
  if (!context.isOperator) return skip('unauthorized-operator');
  if (!context.hasCancelLabel) return skip('cancel-label-missing');
  if (!context.isManaged && !context.hasReadyLabel) return skip('not-managed');
  return transition('Cancelled');
}
