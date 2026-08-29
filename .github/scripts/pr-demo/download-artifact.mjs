#!/usr/bin/env node

import { execFile } from "node:child_process";
import { appendFile, mkdir, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createGitHubClient } from "./github.mjs";

const execFileAsync = promisify(execFile);
const ARTIFACT_NAME_PREFIX = "pr-demo-results-";
export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const SAFE_EXTRACTOR = fileURLToPath(new URL("./safe_extract_zip.py", import.meta.url));

function artifactNameForAttempt(runAttempt) {
  if (!Number.isSafeInteger(runAttempt) || runAttempt <= 0) {
    throw new Error("Pull Request CI run attemptが不正です");
  }
  return `${ARTIFACT_NAME_PREFIX}${runAttempt}`;
}

export function selectArtifactMetadata(artifacts, runAttempt) {
  const artifactName = artifactNameForAttempt(runAttempt);
  if (!Array.isArray(artifacts) || artifacts.length > 200) {
    throw new Error("workflow run artifact一覧が不正です");
  }
  const matches = artifacts.filter((artifact) => artifact?.name === artifactName);
  if (matches.length !== 1) {
    throw new Error(`${artifactName} artifactは正確に1件必要です`);
  }
  const artifact = matches[0];
  if (!Number.isSafeInteger(artifact.id) || artifact.id <= 0) {
    throw new Error("artifact IDが不正です");
  }
  if (artifact.expired !== false) {
    throw new Error("artifactの期限切れ状態が不正です");
  }
  if (
    !Number.isSafeInteger(artifact.size_in_bytes) ||
    artifact.size_in_bytes <= 0 ||
    artifact.size_in_bytes > MAX_ARCHIVE_BYTES
  ) {
    throw new Error("artifactの圧縮sizeが上限を超えています");
  }
  return artifact;
}

export async function safelyExtractArchive({
  archivePath,
  destination,
  extractorPath = SAFE_EXTRACTOR,
}) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "python3",
      [extractorPath, archivePath, destination],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        timeout: 30_000,
        windowsHide: true,
      },
    ));
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim().slice(0, 1000);
    throw new Error(`artifact ZIPを安全に展開できません: ${detail}`);
  }
  let result;
  try {
    result = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`safe extractorのresponseが不正です: ${error.message}`);
  }
  if (
    !Array.isArray(result.entries) ||
    result.entries.length === 0 ||
    result.entries.some((entry) => typeof entry !== "string")
  ) {
    throw new Error("safe extractorのentry一覧が不正です");
  }
  return result.entries;
}

export async function downloadArtifactForRun({
  runId,
  runAttempt,
  archivePath,
  artifactDirectory,
  client,
}) {
  if (
    !Number.isSafeInteger(runId) ||
    runId <= 0 ||
    !Number.isSafeInteger(runAttempt) ||
    runAttempt <= 0
  ) {
    throw new Error("Pull Request CI run IDまたはattemptが不正です");
  }
  const artifact = selectArtifactMetadata(
    await client.getWorkflowRunArtifacts(runId),
    runAttempt,
  );
  await mkdir(dirname(archivePath), { recursive: true, mode: 0o700 });
  await client.downloadArtifactArchive(artifact.id, archivePath, MAX_ARCHIVE_BYTES);
  try {
    return await safelyExtractArchive({ archivePath, destination: artifactDirectory });
  } finally {
    await unlink(archivePath).catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
  }
}

export async function main({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  sourceRunId = process.env.PR_DEMO_SOURCE_RUN_ID,
  sourceRunAttempt = process.env.PR_DEMO_SOURCE_RUN_ATTEMPT,
  archivePath = process.env.PR_DEMO_ARCHIVE_PATH,
  artifactDirectory = process.env.PR_DEMO_ARTIFACT_DIR,
  githubOutputPath = process.env.GITHUB_OUTPUT,
  githubClient,
} = {}) {
  if (!archivePath || !artifactDirectory || !/^[1-9][0-9]*$/.test(sourceRunId ?? "")) {
    throw new Error("artifact download設定またはrun IDが不正です");
  }
  const runId = Number.parseInt(sourceRunId, 10);
  const client = githubClient ?? createGitHubClient({ token, repository });
  let runAttempt;
  if (sourceRunAttempt) {
    if (!/^[1-9][0-9]*$/.test(sourceRunAttempt)) {
      throw new Error("artifact downloadのrun attemptが不正です");
    }
    runAttempt = Number.parseInt(sourceRunAttempt, 10);
  } else {
    const run = await client.getWorkflowRun(runId);
    if (
      run?.id !== runId ||
      !Number.isSafeInteger(run.run_attempt) ||
      run.run_attempt <= 0
    ) {
      throw new Error("GitHub APIからrun attemptを確認できません");
    }
    runAttempt = run.run_attempt;
  }
  if (!Number.isSafeInteger(runAttempt)) {
    throw new Error("artifact downloadのrun attemptが大きすぎます");
  }
  const entries = await downloadArtifactForRun({
    runId,
    runAttempt,
    archivePath,
    artifactDirectory,
    client,
  });
  if (githubOutputPath) {
    await appendFile(
      githubOutputPath,
      `has_media=${entries.includes("manifest.json")}\n`,
    );
  }
  console.log(`[pr-demo] artifactを安全に展開しました: ${entries.join(", ")}`);
  return entries;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
