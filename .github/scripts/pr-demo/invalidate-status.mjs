#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createGitHubClient } from "./github.mjs";
import { extractWorkflowRunContext } from "./publisher.mjs";

export async function invalidateDemoStatus({ event, client }) {
  if (event?.action !== "in_progress") {
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
  if (
    latestRun.id !== context.runId ||
    latestRun.run_attempt !== context.runAttempt ||
    currentHeadSha !== context.headSha
  ) {
    return "stale";
  }

  await client.setDemoStatus(context.headSha, {
    state: "pending",
    description: "最新CIの動作ビデオを待機しています",
    targetUrl: context.runUrl,
  });
  return "pending";
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
  const outcome = await invalidateDemoStatus({ event, client });
  console.log(`[pr-demo] invalidate demo-video=${outcome}`);
  return outcome;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
