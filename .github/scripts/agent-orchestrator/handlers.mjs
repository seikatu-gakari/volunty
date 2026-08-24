import {
  evaluateHumanReview,
  evaluatePrAck,
  evaluateStart,
  hasExactMarker,
  hasStandaloneCursorMention,
  isTerminalStatus,
  parseReadyHeadSha,
  parseRetryMarker,
} from './core.mjs';

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

/** @param {unknown} value @returns {number} */
function timestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Number.NEGATIVE_INFINITY;
}

/** @param {unknown} value @returns {number | null} */
function workflowRunId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** @param {unknown} value @returns {string | null} */
function stringValue(value) {
  return typeof value === 'string' && value !== '' ? value : null;
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

  const isManagedCurrentPullRequest = (pullRequest) => {
    const headRepository = pullRequest?.head?.repository;
    return pullRequest?.state === 'open'
      && pullRequest?.base?.ref === config.defaultBranch
      && typeof pullRequest?.head?.ref === 'string'
      && pullRequest.head.ref.startsWith(config.cursorBranchPrefix)
      && headRepository !== null
      && typeof headRepository === 'object'
      && headRepository.owner === config.owner
      && headRepository.name === config.repository;
  };

  async function listTimedComments(number) {
    if (typeof repository.listIssueComments === 'function') return repository.listIssueComments(number);
    return repository.listComments(number);
  }

  async function getCurrentPullRequest(number) {
    if (typeof repository.getCurrentPullRequest === 'function') return repository.getCurrentPullRequest(number);
    return repository.getPullRequest(number);
  }

  async function currentHeadSha(pullRequest) {
    if (typeof repository.getHeadCommit === 'function') {
      const commit = await repository.getHeadCommit(pullRequest);
      if (typeof commit?.sha !== 'string' || commit.sha === '') throw new Error('head commit must contain sha');
      return commit.sha;
    }
    if (typeof pullRequest?.head?.sha !== 'string' || pullRequest.head.sha === '') throw new Error('pull request head must contain sha');
    return pullRequest.head.sha;
  }

  async function readManagedSession(number) {
    const pullRequest = await getCurrentPullRequest(number);
    if (!isManagedCurrentPullRequest(pullRequest)) return { decision: { kind: 'skip', reason: 'not-managed-pr' }, pullRequest, issue: null, status: null, headSha: null };
    const closingIssues = await repository.findClosingIssues(number);
    if (!Array.isArray(closingIssues) || closingIssues.length !== 1) return { decision: { kind: 'skip', reason: 'invalid-closing-issues' }, pullRequest, issue: null, status: null, headSha: null };
    const issue = await repository.getIssue(closingIssues[0].number);
    const [status, issueComments, headSha] = await Promise.all([
      project.getIssueStatus(issue.id),
      listTimedComments(issue.number),
      currentHeadSha(pullRequest),
    ]);
    if (issue.state !== 'open') return { decision: { kind: 'skip', reason: 'issue-not-open' }, pullRequest, issue, status, headSha };
    if (hasLabel(issue.labels, config.labels.cancel) || isTerminalStatus(status)) return { decision: { kind: 'skip', reason: 'terminal' }, pullRequest, issue, status, headSha };
    if (!hasTrustedDispatchMarker(issueComments, issue.number)) return { decision: { kind: 'skip', reason: 'dispatch-marker-missing' }, pullRequest, issue, status, headSha };
    return { decision: { kind: 'managed' }, pullRequest, issue, status, headSha };
  }

  /** @param {Array<{author: string, body: string, createdAt?: number | string}>} comments */
  function latestReady(comments) {
    const matching = comments
      .filter((comment) => config.agentActors.includes(comment.author))
      .map((comment) => ({ headSha: parseReadyHeadSha(comment.body), createdAt: timestamp(comment.createdAt) }))
      .filter((comment) => comment.headSha !== null && Number.isFinite(comment.createdAt));
    matching.sort((left, right) => right.createdAt - left.createdAt);
    return matching[0] ?? null;
  }

  /** @param {Array<{author: string, body: string, createdAt?: number | string}>} comments @param {Array<{author: string, state: string, submittedAt?: number | string}>} reviews */
  function invalidatedAfter(comments, reviews) {
    const commentTimes = comments
      .filter((comment) => (config.agentActors.includes(comment.author) && hasExactMarker(comment.body, '<!-- agent:human-input -->'))
        || (comment.author === config.operator && hasStandaloneCursorMention(comment.body)))
      .map((comment) => timestamp(comment.createdAt));
    const reviewTimes = reviews
      .filter((review) => review.author === config.operator && review.state === 'changes_requested')
      .map((review) => timestamp(review.submittedAt));
    return Math.max(Number.NEGATIVE_INFINITY, ...commentTimes, ...reviewTimes);
  }

  /** @param {Array<any>} runs @param {string} headSha */
  function newestCurrentHeadRun(runs, headSha) {
    const candidates = runs.filter((run) => run.name === config.ciWorkflow && run.status === 'completed' && run.headSha === headSha);
    candidates.sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt) || right.id - left.id);
    return candidates[0] ?? null;
  }

  async function maybeHumanReview(number) {
    const session = await readManagedSession(number);
    if (session.decision.kind !== 'managed') return session.decision;
    const [comments, reviews, runs] = await Promise.all([
      listTimedComments(number),
      repository.listReviews(session.pullRequest),
      repository.listCiRuns(session.pullRequest, config.ciWorkflow),
    ]);
    const currentRun = newestCurrentHeadRun(runs, session.headSha);
    const decision = evaluateHumanReview({
      status: session.status,
      isDraft: session.pullRequest.draft,
      isOpen: session.pullRequest.state === 'open',
      headSha: session.headSha,
      latestReady: latestReady(comments),
      invalidatedAfter: invalidatedAfter(comments, reviews),
      ciConclusion: currentRun?.conclusion ?? null,
      cancelled: hasLabel(session.issue.labels, config.labels.cancel),
    });
    if (decision.kind !== 'transition') return decision;
    const current = await readManagedSession(number);
    if (current.decision.kind !== 'managed') return current.decision;
    if (current.status !== session.status || current.headSha !== session.headSha) return { kind: 'skip', reason: 'stale-session' };
    await project.transitionIssue(current.issue.id, 'Human Review', ['In Progress', 'Rework']);
    return decision;
  }

  async function handleComment(event) {
    if (!matchesRepository(event, config)) return { kind: 'skip', reason: 'invalid-repository' };
    if (event?.action !== 'created') return { kind: 'skip', reason: 'unsupported-event' };
    if (event?.issue?.pull_request === null || typeof event?.issue?.pull_request !== 'object') return { kind: 'skip', reason: 'not-pull-request-comment' };
    const number = eventNumber(event?.issue?.number);
    const author = stringValue(event?.comment?.user?.login);
    const body = stringValue(event?.comment?.body);
    if (number === null || author === null || body === null) return { kind: 'skip', reason: 'invalid-comment' };
    const first = await readManagedSession(number);
    if (first.decision.kind !== 'managed') return first.decision;

    let target = null;
    if (config.agentActors.includes(author) && hasExactMarker(body, '<!-- agent:human-input -->') && ['In Progress', 'Rework'].includes(first.status)) target = 'Human Input';
    if (author === config.operator && hasStandaloneCursorMention(body) && ['Human Input', 'Blocked', 'Rework'].includes(first.status)) target = 'In Progress';
    if (config.agentActors.includes(author) && parseReadyHeadSha(body) !== null) return maybeHumanReview(number);
    if (target === null) return { kind: 'skip', reason: 'unmatched-comment' };

    const current = await readManagedSession(number);
    if (current.decision.kind !== 'managed') return current.decision;
    if (current.status !== first.status || current.headSha !== first.headSha) return { kind: 'skip', reason: 'stale-session' };
    const allowedFrom = target === 'Human Input' ? ['In Progress', 'Rework'] : ['Human Input', 'Blocked', 'Rework'];
    await project.transitionIssue(current.issue.id, target, allowedFrom);
    return { kind: 'transition', status: target };
  }

  /** @param {unknown} event @param {number} prNumber */
  function eventReferencesPullRequest(event, prNumber) {
    const references = event?.workflow_run?.pull_requests;
    if (!Array.isArray(references)) return false;
    return references.some((reference) => {
      const baseRepository = reference?.base?.repo?.full_name;
      return reference?.number === prNumber && baseRepository === `${config.owner}/${config.repository}`;
    });
  }

  /** @param {unknown} event */
  function eventRun(event) {
    const run = event?.workflow_run;
    const id = workflowRunId(run?.id);
    const name = stringValue(run?.name);
    const status = stringValue(run?.status);
    const conclusion = run?.conclusion === null ? null : stringValue(run?.conclusion);
    const headSha = stringValue(run?.head_sha ?? run?.headSha);
    if (id === null || name === null || status === null || headSha === null || conclusion === null) return null;
    return { id, name, status, conclusion, headSha };
  }

  /** @param {number} number @param {{id: number, headSha: string, url: string}} run @param {number} retry */
  function retryComment(number, run, retry) {
    return `@cursor\n\nPull Request CI が失敗しました。Actions run: ${run.url}\n\n<!-- agent:ci-retry:v1 run_id=${run.id} head_sha=${run.headSha} retry=${retry} -->`;
  }

  async function handleCi(event) {
    if (!matchesRepository(event, config)) return { kind: 'skip', reason: 'invalid-repository' };
    if (event?.action !== 'completed') return { kind: 'skip', reason: 'unsupported-event' };
    const incoming = eventRun(event);
    if (incoming === null || incoming.name !== config.ciWorkflow || incoming.status !== 'completed') return { kind: 'skip', reason: 'invalid-workflow-run' };
    const pullRequests = event?.workflow_run?.pull_requests;
    if (!Array.isArray(pullRequests) || pullRequests.length !== 1) return { kind: 'skip', reason: 'invalid-pull-requests' };
    const number = eventNumber(pullRequests[0]?.number);
    if (number === null || !eventReferencesPullRequest(event, number)) return { kind: 'skip', reason: 'invalid-pull-request' };
    const first = await readManagedSession(number);
    if (first.decision.kind !== 'managed') return first.decision;
    if (incoming.headSha !== first.headSha) return { kind: 'skip', reason: 'stale-head' };
    const runs = await repository.listCiRuns(first.pullRequest, config.ciWorkflow);
    const newest = newestCurrentHeadRun(runs, first.headSha);
    if (newest === null || newest.id !== incoming.id) return { kind: 'skip', reason: 'stale-run' };
    if (newest.conclusion === 'cancelled') return { kind: 'skip', reason: 'cancelled-run' };
    if (newest.conclusion === 'success') return maybeHumanReview(number);
    if (newest.conclusion !== 'failure') return { kind: 'skip', reason: 'non-failure-run' };
    if (!['In Progress', 'Rework'].includes(first.status)) return { kind: 'skip', reason: 'invalid-status' };

    const comments = await listTimedComments(number);
    if (comments.some((comment) => {
      const marker = parseRetryMarker(comment.body);
      return marker !== null && marker.runId === String(newest.id) && marker.headSha === newest.headSha;
    })) return { kind: 'skip', reason: 'already-retried' };
    const latestSuccess = [...runs].filter((run) => run.name === config.ciWorkflow && run.conclusion === 'success')
      .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt) || right.id - left.id)[0] ?? null;
    const retriedRunIds = new Set(comments.map((comment) => parseRetryMarker(comment.body)).filter(Boolean)
      .filter((marker) => {
        const retried = runs.find((run) => String(run.id) === marker.runId);
        return retried !== undefined && (latestSuccess === null || timestamp(retried.updatedAt) > timestamp(latestSuccess.updatedAt));
      }).map((marker) => marker.runId));
    const retry = retriedRunIds.size + 1;
    const current = await readManagedSession(number);
    if (current.decision.kind !== 'managed') return current.decision;
    if (current.status !== first.status || current.headSha !== first.headSha) return { kind: 'skip', reason: 'stale-session' };
    const currentRuns = await repository.listCiRuns(current.pullRequest, config.ciWorkflow);
    const currentNewest = newestCurrentHeadRun(currentRuns, current.headSha);
    if (currentNewest === null || currentNewest.id !== newest.id || currentNewest.conclusion !== 'failure') return { kind: 'skip', reason: 'stale-run' };
    if (retry > config.ciRetryLimit) {
      await project.transitionIssue(current.issue.id, 'Blocked', ['In Progress', 'Rework']);
      return { kind: 'transition', status: 'Blocked' };
    }
    const currentComments = await listTimedComments(number);
    if (currentComments.some((comment) => {
      const marker = parseRetryMarker(comment.body);
      return marker !== null && marker.runId === String(newest.id) && marker.headSha === newest.headSha;
    })) return { kind: 'skip', reason: 'already-retried' };
    await repository.postComment(number, retryComment(number, newest, retry));
    return { kind: 'retry', retry };
  }

  return { handleStart, handlePrCreated, handleComment, handleCi };
}
