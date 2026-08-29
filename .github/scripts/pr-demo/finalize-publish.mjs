#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";

import { finalizePublish } from "./finalizer.mjs";
import { createGitHubClient } from "./github.mjs";

const resultPath = process.env.PR_DEMO_RESULT_PATH;
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!resultPath || !token || !repository) {
  throw new Error("PR_DEMO_RESULT_PATH、GITHUB_TOKEN、GITHUB_REPOSITORYが必要です");
}
const metadata = await stat(resultPath);
if (!metadata.isFile() || metadata.size > 1024 * 1024) {
  throw new Error("publish result fileが不正です");
}
const result = JSON.parse(await readFile(resultPath, "utf8"));
if (result.repository !== repository) {
  throw new Error("publish resultのrepositoryがworkflowと一致しません");
}

const client = createGitHubClient({ token, repository });
const pullRequest = await client.getPullRequest(result.prNumber);
const currentHeadSha = pullRequest?.head?.sha;
if (!/^[0-9a-f]{40}$/.test(currentHeadSha ?? "")) {
  throw new Error("GitHub APIからPRのcurrent HEAD SHAを確認できません");
}

const outcome = await finalizePublish({
  result,
  currentHeadSha,
  siteReady: process.env.PR_DEMO_SITE_READY === "true",
  pagesReady: process.env.PR_DEMO_PAGES_READY === "true",
  client,
});
if (!outcome.success) {
  throw new Error("demo-videoをfailureに設定しました");
}
console.log(`[pr-demo] demo-video=${outcome.state} HEAD=${result.headSha}`);
