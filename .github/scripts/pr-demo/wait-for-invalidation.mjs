#!/usr/bin/env node

import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createGitHubClient } from "./github.mjs";

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DEFAULT_TIMEOUT_MS = 105 * 60 * 1000;
const DEFAULT_POLL_MS = 10 * 1000;
const TRUSTED_PUBLISHER_PATH = ".github/workflows/pr-demo-publish.yml";
const execFileAsync = promisify(execFile);

async function runGit(args) {
  await execFileAsync("git", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
}

function isMissingGitPath(error) {
  return error?.code === 1 || error?.code === 128;
}

export async function baseContainsTrustedPublisher({
  baseSha,
  gitRunner = runGit,
}) {
  if (!SHA_PATTERN.test(baseSha ?? "") || typeof gitRunner !== "function") {
    throw new Error("初回導入判定のbase SHAまたはGit runnerが不正です");
  }
  try {
    await gitRunner(["cat-file", "-e", `${baseSha}^{commit}`]);
  } catch (error) {
    throw new Error("初回導入判定のbase commitを確認できません", {
      cause: error,
    });
  }
  try {
    await gitRunner([
      "cat-file",
      "-e",
      `${baseSha}:${TRUSTED_PUBLISHER_PATH}`,
    ]);
    return true;
  } catch (error) {
    if (isMissingGitPath(error)) {
      return false;
    }
    throw new Error("base上のtrusted publisherを確認できません", {
      cause: error,
    });
  }
}

function buildRunUrl(repository, runId, runAttempt) {
  const baseUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  return runAttempt === 1 ? baseUrl : `${baseUrl}/attempts/${runAttempt}`;
}

function validateWaitOptions({
  repository,
  headSha,
  runId,
  runAttempt,
  client,
  timeoutMs,
  pollMs,
  now,
  sleep,
}) {
  if (
    !REPOSITORY_PATTERN.test(repository ?? "") ||
    !SHA_PATTERN.test(headSha ?? "") ||
    !Number.isSafeInteger(runId) ||
    runId <= 0 ||
    !Number.isSafeInteger(runAttempt) ||
    runAttempt <= 0 ||
    typeof client?.getLatestDemoStatus !== "function" ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > DEFAULT_TIMEOUT_MS ||
    !Number.isSafeInteger(pollMs) ||
    pollMs <= 0 ||
    pollMs > 60 * 1000 ||
    typeof now !== "function" ||
    typeof sleep !== "function"
  ) {
    throw new Error("demo-video invalidation待機設定が不正です");
  }
}

export async function waitForDemoInvalidation({
  repository,
  headSha,
  runId,
  runAttempt,
  client,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollMs = DEFAULT_POLL_MS,
  now = () => Date.now(),
  sleep = (milliseconds) =>
    new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
}) {
  validateWaitOptions({
    repository,
    headSha,
    runId,
    runAttempt,
    client,
    timeoutMs,
    pollMs,
    now,
    sleep,
  });
  const expectedTargetUrl = buildRunUrl(repository, runId, runAttempt);
  const startedAt = now();
  if (!Number.isFinite(startedAt)) {
    throw new Error("demo-video invalidation待機の現在時刻が不正です");
  }
  let lastError;

  while (true) {
    try {
      const status = await client.getLatestDemoStatus(headSha);
      if (
        status?.state === "pending" &&
        status.target_url === expectedTargetUrl
      ) {
        return status;
      }
      lastError = undefined;
    } catch (error) {
      lastError = error;
      console.warn(`[pr-demo] demo-video invalidation status check failed: ${error.message}`);
    }

    const elapsedMs = now() - startedAt;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new Error("demo-video invalidation待機の経過時間が不正です");
    }
    if (elapsedMs >= timeoutMs) {
      break;
    }
    await sleep(Math.min(pollMs, timeoutMs - elapsedMs));
  }

  throw new Error(
    "現在のPull Request CI向けdemo-video pendingを確認できません",
    { ...(lastError ? { cause: lastError } : {}) },
  );
}

export async function main({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  headSha = process.env.PR_DEMO_HEAD_SHA,
  baseSha = process.env.PR_DEMO_BASE_SHA,
  sourceRunId = process.env.PR_DEMO_SOURCE_RUN_ID,
  sourceRunAttempt = process.env.PR_DEMO_SOURCE_RUN_ATTEMPT,
  githubClient,
  gitRunner,
} = {}) {
  if (
    !token ||
    !REPOSITORY_PATTERN.test(repository ?? "") ||
    !SHA_PATTERN.test(headSha ?? "") ||
    !SHA_PATTERN.test(baseSha ?? "") ||
    !/^[1-9][0-9]*$/.test(sourceRunId ?? "") ||
    !/^[1-9][0-9]*$/.test(sourceRunAttempt ?? "")
  ) {
    throw new Error("demo-video invalidation待機のGitHub設定が不正です");
  }
  const hasTrustedPublisher = await baseContainsTrustedPublisher({
    baseSha,
    ...(gitRunner ? { gitRunner } : {}),
  });
  if (!hasTrustedPublisher) {
    console.log(
      "[pr-demo] trusted publisher is absent on base; first-rollout invalidation wait skipped",
    );
    return { state: "bootstrap-skip" };
  }
  const runId = Number.parseInt(sourceRunId, 10);
  const runAttempt = Number.parseInt(sourceRunAttempt, 10);
  const client = githubClient ?? createGitHubClient({ token, repository });
  const status = await waitForDemoInvalidation({
    repository,
    headSha,
    runId,
    runAttempt,
    client,
  });
  console.log(
    `[pr-demo] current CI demo-video invalidation confirmed status=${status.id}`,
  );
  return status;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
