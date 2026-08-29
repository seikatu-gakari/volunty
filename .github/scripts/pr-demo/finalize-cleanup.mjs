#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";

import { finalizeExpiredComments } from "./cleanup.mjs";
import { createGitHubClient } from "./github.mjs";

const resultPath = process.env.PR_DEMO_CLEANUP_RESULT_PATH;
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!resultPath || !token || !repository) {
  throw new Error("PR_DEMO_CLEANUP_RESULT_PATH、GITHUB_TOKEN、GITHUB_REPOSITORYが必要です");
}
const metadata = await stat(resultPath);
if (!metadata.isFile() || metadata.size > 1024 * 1024) {
  throw new Error("cleanup result fileが不正です");
}
const result = JSON.parse(await readFile(resultPath, "utf8"));
if (
  result.schemaVersion !== 1 ||
  result.repository !== repository ||
  !Array.isArray(result.expired) ||
  result.expired.some(
    (demo) =>
      !Number.isSafeInteger(demo.prNumber) ||
      demo.prNumber <= 0 ||
      !/^[0-9a-f]{40}$/.test(demo.headSha ?? ""),
  )
) {
  throw new Error("cleanup resultのschemaが不正です");
}

await finalizeExpiredComments({
  expired: result.expired,
  sitePersisted: process.env.PR_DEMO_SITE_PERSISTED === "true",
  client: createGitHubClient({ token, repository }),
});
console.log(`[pr-demo] ${result.expired.length}件の期限切れcommentを更新しました`);
