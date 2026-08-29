#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDecision } from "./decision.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function collectChangedFiles(cwd, baseSha, headSha) {
  if (!SHA_PATTERN.test(baseSha) || !SHA_PATTERN.test(headSha)) {
    throw new Error("base/head SHAが不正です");
  }

  const result = spawnSync(
    "git",
    [
      "diff",
      "--name-only",
      "--no-renames",
      "--diff-filter=ACMRTD",
      `${baseSha}...${headSha}`,
      "--",
    ],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`変更fileの取得に失敗しました: ${result.stderr.trim()}`);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean)
    .sort();
}

async function writeGithubOutputs(path, decision) {
  if (!path) {
    return;
  }
  await appendFile(
    path,
    [
      `outcome=${decision.outcome}`,
      `required=${decision.required}`,
      `valid=${decision.outcome !== "error"}`,
      "",
    ].join("\n"),
  );
}

export async function main({
  eventPath = process.env.GITHUB_EVENT_PATH,
  outputPath = process.env.PR_DEMO_DECISION_PATH,
  githubOutputPath = process.env.GITHUB_OUTPUT,
  cwd = process.cwd(),
} = {}) {
  if (!eventPath || !outputPath) {
    throw new Error("GITHUB_EVENT_PATHとPR_DEMO_DECISION_PATHが必要です");
  }

  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    throw new Error("pull_request eventが必要です");
  }

  const changedFiles = collectChangedFiles(
    cwd,
    pullRequest.base.sha,
    pullRequest.head.sha,
  );
  const decision = {
    ...createDecision(event, changedFiles),
    evaluatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(decision, null, 2)}\n`, {
    mode: 0o600,
  });
  await writeGithubOutputs(githubOutputPath, decision);

  console.log(
    `[pr-demo] outcome=${decision.outcome} required=${decision.required} reason=${decision.reason}`,
  );
  if (decision.outcome === "error") {
    process.exitCode = 1;
  }

  return decision;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
