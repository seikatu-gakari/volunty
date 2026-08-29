#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  finalizeHandoffFailure,
  finalizePublish,
} from "./finalizer.mjs";
import { createGitHubClient } from "./github.mjs";
import {
  buildManualFallbackContext,
  resolveWorkflowRunEvent,
} from "./prepare-publish.mjs";
import { buildFailureResult } from "./publisher.mjs";

async function readPublishResult(resultPath, repository) {
  if (!resultPath) {
    throw new Error("PR_DEMO_RESULT_PATHが必要です");
  }
  const metadata = await stat(resultPath);
  if (!metadata.isFile() || metadata.size > 1024 * 1024) {
    throw new Error("publish result fileが不正です");
  }
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (result.repository !== repository) {
    throw new Error("publish resultのrepositoryがworkflowと一致しません");
  }
  return result;
}

async function resolveFallbackEvent({
  eventPath,
  repository,
  manualForkApproval,
  sourceRunId,
  sourceRunAttempt,
  client,
}) {
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATHが必要です");
  }
  const rawEvent = JSON.parse(await readFile(eventPath, "utf8"));
  if (rawEvent.repository?.full_name !== repository) {
    throw new Error("workflow eventのrepositoryが一致しません");
  }
  return resolveWorkflowRunEvent({
    event: rawEvent,
    manualForkApproval,
    sourceRunId,
    sourceRunAttempt,
    repository,
    client,
  });
}

export async function main({
  resultPath = process.env.PR_DEMO_RESULT_PATH,
  eventPath = process.env.GITHUB_EVENT_PATH,
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  manualForkApproval = process.env.PR_DEMO_MANUAL_FORK_APPROVAL === "true",
  sourceRunId = process.env.PR_DEMO_SOURCE_RUN_ID,
  sourceRunAttempt = process.env.PR_DEMO_SOURCE_RUN_ATTEMPT,
  manualPrNumber = process.env.PR_DEMO_MANUAL_PR_NUMBER,
  manualHeadSha = process.env.PR_DEMO_MANUAL_HEAD_SHA,
  siteReady = process.env.PR_DEMO_SITE_READY === "true",
  pagesReady = process.env.PR_DEMO_PAGES_READY === "true",
  githubClient,
} = {}) {
  if (!token || !repository) {
    throw new Error("GITHUB_TOKENとGITHUB_REPOSITORYが必要です");
  }
  const client = githubClient ?? createGitHubClient({ token, repository });
  let result;
  try {
    result = await readPublishResult(resultPath, repository);
  } catch (handoffError) {
    console.warn(`[pr-demo] finalizer handoff failure: ${handoffError.message}`);
    let outcome;
    try {
      const resolved = await resolveFallbackEvent({
        eventPath,
        repository,
        manualForkApproval,
        sourceRunId,
        sourceRunAttempt,
        client,
      });
      outcome = await finalizeHandoffFailure({
        event: resolved.event,
        reason: "finalizer handoffを取得できませんでした",
        client,
      });
    } catch (resolutionError) {
      if (manualForkApproval !== true) {
        throw resolutionError;
      }
      const context = buildManualFallbackContext({
        repository,
        sourceRunId,
        sourceRunAttempt,
        manualPrNumber,
        manualHeadSha,
      });
      outcome = await finalizePublish({
        result: buildFailureResult(
          context,
          `手動承認runを解決できませんでした: ${resolutionError.message}`,
        ),
        siteReady: false,
        pagesReady: false,
        client,
      });
    }
    if (!outcome.success) {
      throw new Error("demo-videoをfailureに設定しました");
    }
    console.log(`[pr-demo] demo-video=${outcome.state} handoff=failure`);
    return outcome;
  }

  if (result.manualFallback === true) {
    if (manualForkApproval !== true) {
      throw new Error("手動承認fallback resultはworkflow_dispatchだけで使用できます");
    }
    const expected = buildManualFallbackContext({
      repository,
      sourceRunId,
      sourceRunAttempt,
      manualPrNumber,
      manualHeadSha,
    });
    for (const key of [
      "prNumber",
      "headSha",
      "repository",
      "runId",
      "runAttempt",
      "runUrl",
    ]) {
      if (result[key] !== expected[key]) {
        throw new Error("手動承認fallback resultがworkflow入力と一致しません");
      }
    }
    const outcome = await finalizePublish({
      result,
      siteReady: false,
      pagesReady: false,
      client,
    });
    if (!outcome.success) {
      throw new Error("demo-videoをfailureに設定しました");
    }
    console.log(`[pr-demo] demo-video=${outcome.state} manual-fallback=true`);
    return outcome;
  }

  const pullRequest = await client.getPullRequest(result.prNumber);
  const currentHeadSha = pullRequest?.head?.sha;
  if (!/^[0-9a-f]{40}$/.test(currentHeadSha ?? "")) {
    throw new Error("GitHub APIからPRのcurrent HEAD SHAを確認できません");
  }
  const latestRun =
    currentHeadSha === result.headSha
      ? await client.getLatestPullRequestCiRun(result.prNumber, result.headSha)
      : undefined;

  const outcome = await finalizePublish({
    result,
    currentHeadSha,
    latestRunId: latestRun?.id,
    latestRunAttempt: latestRun?.run_attempt,
    siteReady,
    pagesReady,
    client,
  });
  if (!outcome.success) {
    throw new Error("demo-videoをfailureに設定しました");
  }
  console.log(`[pr-demo] demo-video=${outcome.state} HEAD=${result.headSha}`);
  return outcome;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
