#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateResult } from "./finalizer.mjs";
import { createGitHubClient } from "./github.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const MAX_RESULT_BYTES = 1024 * 1024;

export async function confirmPublishFreshness({ result, client }) {
  const validatedResult = validateResult(result);
  if (
    typeof client?.getPullRequest !== "function" ||
    typeof client?.getLatestPullRequestCiRun !== "function"
  ) {
    throw new Error("Pages公開直前のGitHub clientが不正です");
  }

  const pullRequest = await client.getPullRequest(validatedResult.prNumber);
  const currentHeadSha = pullRequest?.head?.sha;
  if (!SHA_PATTERN.test(currentHeadSha ?? "")) {
    throw new Error("GitHub APIからPRのcurrent HEAD SHAを確認できません");
  }
  if (currentHeadSha !== validatedResult.headSha) {
    throw new Error("準備済みPages treeはPRのcurrent HEADではありません");
  }

  const latestRun = await client.getLatestPullRequestCiRun(
    validatedResult.prNumber,
    validatedResult.headSha,
  );
  if (
    !Number.isSafeInteger(latestRun?.id) ||
    latestRun.id <= 0 ||
    !Number.isSafeInteger(latestRun.run_attempt) ||
    latestRun.run_attempt <= 0 ||
    !["queued", "in_progress", "completed"].includes(latestRun.status)
  ) {
    throw new Error("GitHub APIから最新Pull Request CIを確認できません");
  }
  if (
    latestRun.id !== validatedResult.runId ||
    latestRun.run_attempt !== validatedResult.runAttempt ||
    latestRun.status !== "completed"
  ) {
    throw new Error("準備済みPages treeは最新Pull Request CIではありません");
  }
  return validatedResult;
}

async function readResult(resultPath) {
  if (!resultPath) {
    throw new Error("PR_DEMO_RESULT_PATHが必要です");
  }
  const metadata = await stat(resultPath);
  if (!metadata.isFile() || metadata.size > MAX_RESULT_BYTES) {
    throw new Error("publish result fileが不正です");
  }
  return JSON.parse(await readFile(resultPath, "utf8"));
}

export async function main({
  resultPath = process.env.PR_DEMO_RESULT_PATH,
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  githubClient,
} = {}) {
  if (!token || !repository) {
    throw new Error("GITHUB_TOKENとGITHUB_REPOSITORYが必要です");
  }
  const result = await readResult(resultPath);
  if (result?.repository !== repository) {
    throw new Error("publish resultのrepositoryがworkflowと一致しません");
  }
  const client = githubClient ?? createGitHubClient({ token, repository });
  const confirmed = await confirmPublishFreshness({ result, client });
  console.log(
    `[pr-demo] publish freshness confirmed HEAD=${confirmed.headSha} run=${confirmed.runId} attempt=${confirmed.runAttempt}`,
  );
  return confirmed;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
