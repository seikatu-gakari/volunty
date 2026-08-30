import {
  COMMENT_MARKER,
  buildFailureComment,
  buildSkippedComment,
} from "./artifact.mjs";
import {
  buildFailureResult,
  extractWorkflowRunContext,
} from "./publisher.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function isMatchingManualForkSuccess(status, result) {
  if (status === undefined || status.state !== "success") {
    return false;
  }
  const [owner, name] = result.repository.split("/");
  const manifestUrl = new URL(
    `/${name}/pr/${result.prNumber}/${result.headSha}/manifest.json`,
    `https://${owner}.github.io`,
  ).toString();
  return status.target_url === result.runUrl || status.target_url === manifestUrl;
}

export function validateResult(result) {
  if (
    result?.schemaVersion !== 1 ||
    !["published", "skip", "failure", "stale"].includes(result.outcome) ||
    !Number.isSafeInteger(result.prNumber) ||
    result.prNumber <= 0 ||
    !SHA_PATTERN.test(result.headSha ?? "") ||
    !REPOSITORY_PATTERN.test(result.repository ?? "") ||
    !Number.isSafeInteger(result.runId) ||
    result.runId <= 0 ||
    !Number.isSafeInteger(result.runAttempt) ||
    result.runAttempt <= 0 ||
    typeof result.reason !== "string" ||
    result.reason.length > 300 ||
    typeof result.siteChanged !== "boolean" ||
    (result.manualFallback !== undefined && result.manualFallback !== true) ||
    (result.unapprovedFork !== undefined && result.unapprovedFork !== true)
  ) {
    throw new Error("publish resultのschemaが不正です");
  }
  const runBaseUrl = `https://github.com/${result.repository}/actions/runs/${result.runId}`;
  const expectedRunUrl =
    result.runAttempt === 1
      ? runBaseUrl
      : `${runBaseUrl}/attempts/${result.runAttempt}`;
  if (result.runUrl !== expectedRunUrl) {
    throw new Error("publish resultのrun URLが不正です");
  }

  if (result.outcome === "published") {
    const expectedSuffix = `/pr/${result.prNumber}/${result.headSha}/manifest.json`;
    if (
      result.siteChanged !== true ||
      !result.comment?.startsWith(COMMENT_MARKER) ||
      !result.manifestUrl?.startsWith("https://") ||
      !result.manifestUrl.endsWith(expectedSuffix) ||
      !/^[0-9a-f]{64}$/.test(result.manifestSha256 ?? "")
    ) {
      throw new Error("published resultのPages情報が不正です");
    }
  } else if (result.outcome === "stale" && result.siteChanged !== false) {
    throw new Error("stale resultはsiteを変更できません");
  } else if (
    result.manualFallback === true &&
    (result.outcome !== "failure" || result.siteChanged !== false)
  ) {
    throw new Error("手動承認fallback resultが不正です");
  } else if (
    result.unapprovedFork === true &&
    (result.outcome !== "failure" || result.manualFallback === true)
  ) {
    throw new Error("未承認fork resultが不正です");
  }
  return result;
}

async function publishFailure({ result, reason, client }) {
  const body = buildFailureComment({
    headSha: result.headSha,
    reason,
    runUrl: result.runUrl,
  });
  let commentError;
  try {
    await client.upsertDemoComment(result.prNumber, body);
  } catch (error) {
    commentError = error;
  }
  await client.setDemoStatus(result.headSha, {
    state: "failure",
    description: "動作ビデオの公開に失敗しました",
    targetUrl: result.runUrl,
  });
  if (commentError) {
    throw commentError;
  }
  return { success: false, state: "failure" };
}

export async function finalizeHandoffFailure({
  event,
  reason,
  client,
  forkApproved = false,
}) {
  const context = extractWorkflowRunContext(event);
  const result = {
    ...buildFailureResult(context, reason),
    ...(!context.sameRepository && forkApproved !== true
      ? { unapprovedFork: true }
      : {}),
  };
  const [latestRun, pullRequest] = await Promise.all([
    client.getLatestPullRequestCiRun(context.prNumber, context.headSha),
    client.getPullRequest(context.prNumber),
  ]);
  const outcome = await finalizePublish({
    result,
    currentHeadSha: pullRequest?.head?.sha,
    latestRunId: latestRun?.id,
    latestRunAttempt: latestRun?.run_attempt,
    siteReady: false,
    pagesReady: false,
    client,
  });
  return { ...outcome, result };
}

export async function finalizePublish({
  result: unvalidatedResult,
  currentHeadSha,
  latestRunId,
  latestRunAttempt,
  siteReady,
  pagesReady,
  client,
}) {
  const result = validateResult(unvalidatedResult);
  if (currentHeadSha !== undefined && !SHA_PATTERN.test(currentHeadSha)) {
    throw new Error("PRのcurrent HEAD SHAが不正です");
  }
  const hasLatestRunId = latestRunId !== undefined;
  const hasLatestRunAttempt = latestRunAttempt !== undefined;
  if (
    hasLatestRunId !== hasLatestRunAttempt ||
    (hasLatestRunId &&
      (!Number.isSafeInteger(latestRunId) ||
        latestRunId <= 0 ||
        !Number.isSafeInteger(latestRunAttempt) ||
        latestRunAttempt <= 0))
  ) {
    throw new Error("最新Pull Request CI run IDが不正です");
  }
  if (currentHeadSha && currentHeadSha !== result.headSha) {
    return { success: true, state: "stale" };
  }
  if (result.outcome === "stale") {
    return { success: true, state: "stale" };
  }
  if (
    hasLatestRunId &&
    (latestRunId !== result.runId || latestRunAttempt !== result.runAttempt)
  ) {
    return { success: true, state: "stale" };
  }
  if (result.unapprovedFork === true) {
    if (
      typeof client.getLatestDemoStatus !== "function" ||
      typeof client.hasManualForkApproval !== "function"
    ) {
      throw new Error("fork手動承認stateを確認できません");
    }
    const latestStatus = await client.getLatestDemoStatus(result.headSha);
    if (
      isMatchingManualForkSuccess(latestStatus, result) ||
      (await client.hasManualForkApproval(result))
    ) {
      return { success: true, state: "stale" };
    }
  }
  if (result.outcome === "skip") {
    if (result.siteChanged && siteReady !== true) {
      return publishFailure({
        result,
        reason: "対象外PRの旧動画をGitHub Pagesから削除できませんでした",
        client,
      });
    }
    await client.upsertDemoComment(
      result.prNumber,
      buildSkippedComment({ headSha: result.headSha, reason: result.reason }),
      { createIfMissing: false },
    );
    await client.setDemoStatus(result.headSha, {
      state: "success",
      description: "動作ビデオ対象外",
      targetUrl: result.runUrl,
    });
    return { success: true, state: "success" };
  }
  if (result.outcome === "failure") {
    if (result.siteChanged && siteReady !== true) {
      return publishFailure({
        result,
        reason: `旧動画をGitHub Pagesから削除できませんでした; ${result.reason}`,
        client,
      });
    }
    return publishFailure({ result, reason: result.reason, client });
  }
  if (siteReady !== true) {
    return publishFailure({
      result,
      reason: "動作ビデオをgh-pagesへ永続化できませんでした",
      client,
    });
  }
  if (pagesReady !== true) {
    return publishFailure({
      result,
      reason: "GitHub Pagesで最新HEADのmanifestを確認できませんでした",
      client,
    });
  }

  await client.upsertDemoComment(result.prNumber, result.comment);
  await client.setDemoStatus(result.headSha, {
    state: "success",
    description: "最新HEADの動作ビデオを公開しました",
    targetUrl: result.manifestUrl,
  });
  return { success: true, state: "success" };
}
