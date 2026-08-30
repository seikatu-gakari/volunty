#!/usr/bin/env node

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { cleanupExpiredDemos } from "./cleanup.mjs";
import { createGitHubClient } from "./github.mjs";

const siteDirectory = process.env.PR_DEMO_SITE_DIR;
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const resultPath = process.env.PR_DEMO_CLEANUP_RESULT_PATH;
if (!siteDirectory || !token || !repository || !resultPath) {
  throw new Error(
    "PR_DEMO_SITE_DIR、PR_DEMO_CLEANUP_RESULT_PATH、GITHUB_TOKEN、GITHUB_REPOSITORYが必要です",
  );
}

const result = await cleanupExpiredDemos({
  siteDirectory,
  client: createGitHubClient({ token, repository }),
});
await mkdir(dirname(resultPath), { recursive: true });
await writeFile(
  resultPath,
  `${JSON.stringify({ schemaVersion: 1, repository, expired: result.expired }, null, 2)}\n`,
  { mode: 0o600 },
);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `changed=${result.requiresDeployment}`,
      `pending=${result.expired.length > 0}`,
      `removed=${result.removed.join(",")}`,
      "",
    ].join("\n"),
  );
}
console.log(
  result.removed.length > 0
    ? `[pr-demo] 期限切れPRを削除しました: ${result.removed.join(", ")}`
    : result.expired.length > 0
      ? `[pr-demo] ${result.expired.length}件の期限切れcommentを再試行します`
      : "[pr-demo] 期限切れPRはありません",
);
