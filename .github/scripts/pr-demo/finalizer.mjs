import {
  COMMENT_MARKER,
  buildFailureComment,
  buildSkippedComment,
} from "./artifact.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function validateResult(result) {
  if (
    result?.schemaVersion !== 1 ||
    !["published", "skip", "failure", "stale"].includes(result.outcome) ||
    !Number.isSafeInteger(result.prNumber) ||
    result.prNumber <= 0 ||
    !SHA_PATTERN.test(result.headSha ?? "") ||
    !REPOSITORY_PATTERN.test(result.repository ?? "") ||
    typeof result.reason !== "string" ||
    result.reason.length > 300 ||
    typeof result.siteChanged !== "boolean"
  ) {
    throw new Error("publish resultのschemaが不正です");
  }
  const runPrefix = `https://github.com/${result.repository}/actions/runs/`;
  if (!result.runUrl?.startsWith(runPrefix)) {
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

export async function finalizePublish({
  result: unvalidatedResult,
  currentHeadSha,
  siteReady,
  pagesReady,
  client,
}) {
  const result = validateResult(unvalidatedResult);
  if (currentHeadSha !== undefined && !SHA_PATTERN.test(currentHeadSha)) {
    throw new Error("PRのcurrent HEAD SHAが不正です");
  }
  if (currentHeadSha && currentHeadSha !== result.headSha) {
    return { success: true, state: "stale" };
  }
  if (result.outcome === "stale") {
    return { success: true, state: "stale" };
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
    return publishFailure({ result, reason: result.reason, client });
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
