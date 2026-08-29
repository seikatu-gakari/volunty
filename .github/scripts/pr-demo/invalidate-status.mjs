#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createGitHubClient } from "./github.mjs";
import { extractWorkflowRunContext } from "./publisher.mjs";

const DEFAULT_ATTEMPTS = 6;

function sleepFor(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function invalidateDemoStatus({ event, client }) {
  if (!["requested", "in_progress"].includes(event?.action)) {
    return "ignored";
  }

  const context = extractWorkflowRunContext(event);
  const [latestRun, pullRequest] = await Promise.all([
    client.getLatestPullRequestCiRun(context.prNumber, context.headSha),
    client.getPullRequest(context.prNumber),
  ]);
  const currentHeadSha = pullRequest?.head?.sha;
  if (!/^[0-9a-f]{40}$/.test(currentHeadSha ?? "")) {
    throw new Error("GitHub APIからPRのcurrent HEAD SHAを確認できません");
  }
  if (currentHeadSha !== context.headSha) {
    return "stale";
  }

  let targetUrl = context.runUrl;
  let outcome = "pending";
  if (
    latestRun.id !== context.runId ||
    latestRun.run_attempt !== context.runAttempt
  ) {
    if (!["queued", "in_progress"].includes(latestRun.status)) {
      return "stale";
    }
    const latestRunBaseUrl =
      `https://github.com/${context.repository}/actions/runs/${latestRun.id}`;
    targetUrl =
      latestRun.run_attempt === 1
        ? latestRunBaseUrl
        : `${latestRunBaseUrl}/attempts/${latestRun.run_attempt}`;
    outcome = "pending-latest";
  }

  await client.setDemoStatus(context.headSha, {
    state: "pending",
    description: "最新CIの動作ビデオを待機しています",
    targetUrl,
  });
  return outcome;
}

export async function invalidateDemoStatusWithRetry({
  event,
  client,
  attempts = DEFAULT_ATTEMPTS,
  sleep = sleepFor,
}) {
  if (
    !Number.isSafeInteger(attempts) ||
    attempts <= 0 ||
    attempts > 10 ||
    typeof sleep !== "function"
  ) {
    throw new Error("demo-video invalidatorの再試行設定が不正です");
  }

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await invalidateDemoStatus({ event, client });
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 16_000);
      console.warn(
        `[pr-demo] demo-video invalidation retry ${attempt}/${attempts}: ${error.message}`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

export async function main({
  eventPath = process.env.GITHUB_EVENT_PATH,
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  githubClient,
} = {}) {
  if (!eventPath || !token || !repository) {
    throw new Error("GITHUB_EVENT_PATH、GITHUB_TOKEN、GITHUB_REPOSITORYが必要です");
  }
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  if (event.repository?.full_name !== repository) {
    throw new Error("workflow_runのrepositoryがworkflowと一致しません");
  }
  const client = githubClient ?? createGitHubClient({ token, repository });
  const outcome = await invalidateDemoStatusWithRetry({ event, client });
  console.log(`[pr-demo] invalidate demo-video=${outcome}`);
  return outcome;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
