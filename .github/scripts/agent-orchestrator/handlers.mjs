import { evaluatePrAck, evaluateStart, hasExactMarker, isTerminalStatus } from './core.mjs';

/** @param {unknown} value @returns {number | null} */
function eventNumber(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** @param {unknown} event @param {{owner: string, repository: string}} config */
function matchesRepository(event, config) {
  if (event === null || typeof event !== 'object') return false;
  const repository = /** @type {Record<string, unknown>} */ (event).repository;
  if (repository === null || typeof repository !== 'object') return false;
  const record = /** @type {Record<string, unknown>} */ (repository);
  if (record.full_name === `${config.owner}/${config.repository}`) return true;
  const owner = record.owner;
  return record.name === config.repository && owner !== null && typeof owner === 'object'
    && /** @type {Record<string, unknown>} */ (owner).login === config.owner;
}

/** @param {string[]} labels @param {string} label */
function hasLabel(labels, label) { return labels.includes(label); }

/** @param {string} title */
function branchSlug(title) {
  const normalized = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'safe';
}

/** @param {number} number @param {string} title */
function dispatchComment(number, title) {
  const branch = `cursor/issue-${number}-${branchSlug(title)}`;
  return `<!-- agent:dispatch:v1 issue=${number} -->
@cursor

Issue #${number} を担当してください。まず \`${branch}\` branch を作成し、必要なら \`git commit --allow-empty\` で早期に Draft PR を作成してください。PR base は \`main\`、本文には **ちょうど一つ** \`Fixes #${number}\` を含めます。

重要な判断が必要なら、PR に \`<!-- agent:human-input -->\` を含め、判断事項・理由・選択肢・Pros/Cons・推奨案・求める回答を投稿して停止してください（Human Input protocol）。

実装、必要なテスト、セルフレビュー、lint / UT / build を行ってから \`gh pr ready\` を実行し、最後に current SHA を含む \`<!-- agent:ready-for-review -->\` と \`<!-- agent:ready-for-review:v1 head_sha=... -->\` を PR に投稿してください。

\`main\` へ merge しないでください。GitHub Project Status、\`agent-ready\`、\`agent-cancel\` は変更しないでください。`;
}

/** @param {unknown} summary @param {string} line */
function report(summary, line) {
  if (summary && typeof summary === 'object' && typeof /** @type {Record<string, unknown>} */ (summary).add === 'function') {
    /** @type {{add: (line: string) => void}} */ (summary).add(line);
  }
}

/** @param {{repository: any, project: any, config: any, summary?: unknown}} options */
export function createHandlers({ repository, project, config, summary }) {
  const dispatchMarker = (number) => `<!-- agent:dispatch:v1 issue=${number} -->`;
  const hasTrustedDispatchMarker = (comments, number) => comments.some((comment) => comment.author === config.operator && hasExactMarker(comment.body, dispatchMarker(number)));
  const isManagedPullRequest = (pullRequest) => {
    const headRepository = pullRequest.headRepository;
    return pullRequest.state === 'open'
      && pullRequest.baseRefName === config.defaultBranch
      && pullRequest.headRefName.startsWith(config.cursorBranchPrefix)
      && headRepository !== null
      && typeof headRepository === 'object'
      && headRepository.owner === config.owner
      && headRepository.name === config.repository;
  };

  async function readStart(number) {
    const current = await repository.getIssue(number);
    const [actor, status, dependencies, comments, pullRequests] = await Promise.all([
      repository.getLatestLabelActor(number, config.labels.ready),
      project.getIssueStatus(current.id),
      repository.listIssueDependencies(number),
      repository.listComments(number),
      repository.findClosingPullRequests(number),
    ]);
    const baseDecision = evaluateStart({
      isOperator: actor === config.operator,
      isOpen: current.state === 'open',
      hasReadyLabel: hasLabel(current.labels, config.labels.ready),
      hasCancelLabel: hasLabel(current.labels, config.labels.cancel),
      status,
      hasOpenDependencies: dependencies.some((dependency) => dependency.state === 'open'),
      hasDispatchMarker: hasTrustedDispatchMarker(comments, number),
      hasManagedPullRequest: pullRequests.some(isManagedPullRequest),
    });
    return {
      issue: current,
      status,
      decision: baseDecision,
    };
  }

  async function dispatch(number) {
    const first = await readStart(number);
    if (first.decision.kind !== 'dispatch') return first.decision;
    if (first.status === null) {
      const beforeInitialization = await readStart(number);
      if (beforeInitialization.decision.kind !== 'dispatch' || beforeInitialization.status !== null) return beforeInitialization.decision;
      await project.ensureIssueItem(beforeInitialization.issue.id);
      const beforeTransition = await readStart(number);
      if (beforeTransition.decision.kind !== 'dispatch' || beforeTransition.status !== null) return beforeTransition.decision;
      await project.transitionIssue(beforeTransition.issue.id, 'Backlog', [null]);
    }
    const current = await readStart(number);
    if (current.decision.kind !== 'dispatch') return current.decision;
    if (current.status !== 'Backlog') return { kind: 'skip', reason: 'invalid-status' };
    await repository.postComment(number, dispatchComment(number, current.issue.title));
    report(summary, `Issue #${number}: Cursor dispatch posted`);
    return current.decision;
  }

  /** @param {unknown} event @param {{eventName?: string}} [context] */
  async function handleStart(event, { eventName } = {}) {
    if (!matchesRepository(event, config)) return { kind: 'skip', reason: 'invalid-repository' };
    const action = event?.action;
    if (eventName === 'workflow_dispatch') {
      const resolved = await project.resolveProject();
      report(summary, `Read-only preflight: project=${resolved.projectId}, statusField=${resolved.statusFieldId}`);
      return { kind: 'preflight' };
    }
    const number = eventNumber(event?.issue?.number);
    if (number === null) return { kind: 'skip', reason: 'invalid-issue' };
    if (action === 'opened') {
      const current = await repository.getIssue(number);
      await project.ensureIssueItem(current.id);
      if (await project.getIssueStatus(current.id) === null) {
        await project.transitionIssue(current.id, 'Backlog', [null]);
      }
      return { kind: 'initialized' };
    }
    if (action === 'labeled') {
      if (event?.label?.name !== config.labels.ready) return { kind: 'skip', reason: 'unrelated-label' };
      return dispatch(number);
    }
    if (action === 'closed') {
      const blocked = await repository.listBlockedBy(number);
      const results = [];
      for (const candidate of blocked) {
        if (candidate.state === 'open' && hasLabel(candidate.labels, config.labels.ready)) results.push(await dispatch(candidate.number));
      }
      return { kind: 're-evaluated', results };
    }
    return { kind: 'skip', reason: 'unsupported-event' };
  }

  async function readPrAck(number) {
    const pullRequest = await repository.getPullRequest(number);
    const closingIssues = await repository.findClosingIssues(number);
    if (closingIssues.length !== 1) {
      return { decision: { kind: 'skip', reason: 'invalid-closing-issues' }, pullRequest, issue: null, status: null };
    }
    const current = await repository.getIssue(closingIssues[0].number);
    const [comments, status] = await Promise.all([
      repository.listComments(current.number),
      project.getIssueStatus(current.id),
    ]);
    if (hasLabel(current.labels, config.labels.cancel) || isTerminalStatus(status)) return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'terminal' } };
    if (pullRequest.state !== 'open') return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'pr-not-open' } };
    if (current.state !== 'open') return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'issue-not-open' } };
    if (!pullRequest.draft) return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'pr-not-draft' } };
    if (pullRequest.base.ref !== config.defaultBranch) return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'invalid-base' } };
    if (!pullRequest.head.ref.startsWith(config.cursorBranchPrefix)) return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'invalid-branch' } };
    if (!hasTrustedDispatchMarker(comments, current.number)) return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'dispatch-marker-missing' } };
    if (status === 'In Progress' && !hasLabel(current.labels, config.labels.ready)) return { pullRequest, issue: current, status, decision: { kind: 'unchanged' } };
    if (status === 'In Progress' && hasLabel(current.labels, config.labels.ready)) return { pullRequest, issue: current, status, decision: { kind: 'label-pending' } };
    if (status === 'Backlog' && !hasLabel(current.labels, config.labels.ready)) return { pullRequest, issue: current, status, decision: { kind: 'skip', reason: 'ready-label-missing' } };
    return {
      pullRequest,
      issue: current,
      status,
      decision: evaluatePrAck({
        status,
        isOpen: true,
        isDraft: pullRequest.draft,
        isDefaultBranch: pullRequest.base.ref === config.defaultBranch,
        hasCursorBranch: pullRequest.head.ref.startsWith(config.cursorBranchPrefix),
        closingIssueCount: closingIssues.length,
        hasReadyLabel: true,
        hasDispatchMarker: true,
        cancelled: false,
      }),
    };
  }

  async function handlePrCreated(event) {
    if (!matchesRepository(event, config)) return { kind: 'skip', reason: 'invalid-repository' };
    if (event?.action !== 'opened') return { kind: 'skip', reason: 'unsupported-event' };
    const number = eventNumber(event?.number ?? event?.pull_request?.number);
    if (number === null) return { kind: 'skip', reason: 'invalid-pull-request' };
    const first = await readPrAck(number);
    if (!['transition', 'label-pending'].includes(first.decision.kind)) return first.decision;
    const current = await readPrAck(number);
    if (!['transition', 'label-pending'].includes(current.decision.kind) || current.issue === null) return current.decision;
    if (current.decision.kind === 'transition') {
      await project.transitionIssue(current.issue.id, 'In Progress', ['Backlog']);
    }
    const beforeLabelRemoval = await readPrAck(number);
    if (beforeLabelRemoval.decision.kind !== 'label-pending' || beforeLabelRemoval.issue === null) {
      throw new Error('Draft PR ACK partially mutated before label removal');
    }
    await repository.removeLabel(beforeLabelRemoval.issue.number, config.labels.ready);
    const completed = await readPrAck(number);
    if (completed.decision.kind !== 'unchanged') throw new Error('Draft PR ACK partially mutated after label removal');
    report(summary, `PR #${number}: Draft ACK completed`);
    return { kind: 'transition', status: 'In Progress' };
  }

  return { handleStart, handlePrCreated };
}
