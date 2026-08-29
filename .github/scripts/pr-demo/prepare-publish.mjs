#!/usr/bin/env node

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildFailureResult,
  buildStaleResult,
  extractWorkflowRunContext,
  preparePublish,
  removePublishedDemoForResult,
} from "./publisher.mjs";
import { createGitHubClient } from "./github.mjs";
import { createDecision } from "./decision.mjs";

export async function resolveWorkflowRunEvent({
  event,
  manualForkApproval,
  sourceRunId,
  repository,
  client,
}) {
  if (event?.workflow_run) {
    return { event, forkApproved: false };
  }
  if (manualForkApproval !== true || !/^[1-9][0-9]*$/.test(sourceRunId ?? "")) {
    throw new Error("workflow_dispatchには承認対象のPull Request CI run IDが必要です");
  }
  const runId = Number.parseInt(sourceRunId, 10);
  if (!Number.isSafeInteger(runId)) {
    throw new Error("Pull Request CI run IDが大きすぎます");
  }
  const [run, pullRequests] = await Promise.all([
    client.getWorkflowRun(runId),
    client.getWorkflowRunPullRequests(runId),
  ]);
  if (run.id !== runId || (run.repository?.full_name && run.repository.full_name !== repository)) {
    throw new Error("指定workflow runが対象repositoryと一致しません");
  }
  return {
    event: {
      repository: { full_name: repository },
      workflow_run: { ...run, pull_requests: pullRequests },
    },
    forkApproved: true,
  };
}

async function writeOutputs(path, result) {
  if (!path) {
    return;
  }
  await appendFile(
    path,
    [
      `outcome=${result.outcome}`,
      `site_changed=${result.siteChanged}`,
      `manifest_url=${result.manifestUrl ?? ""}`,
      `manifest_sha256=${result.manifestSha256 ?? ""}`,
      `head_sha=${result.headSha}`,
      "",
    ].join("\n"),
  );
}

export async function main({
  eventPath = process.env.GITHUB_EVENT_PATH,
  artifactDirectory = process.env.PR_DEMO_ARTIFACT_DIR,
  siteDirectory = process.env.PR_DEMO_SITE_DIR,
  resultPath = process.env.PR_DEMO_RESULT_PATH,
  githubOutputPath = process.env.GITHUB_OUTPUT,
  pagesBaseUrl = process.env.PR_DEMO_PAGES_BASE_URL,
  githubClient,
  manualForkApproval = process.env.PR_DEMO_MANUAL_FORK_APPROVAL === "true",
  sourceRunId = process.env.PR_DEMO_SOURCE_RUN_ID,
} = {}) {
  if (!eventPath || !artifactDirectory || !siteDirectory || !resultPath || !pagesBaseUrl) {
    throw new Error("publisherのevent/artifact/site/result/Pages設定が不足しています");
  }

  const rawEvent = JSON.parse(await readFile(eventPath, "utf8"));
  const repository = process.env.GITHUB_REPOSITORY ?? rawEvent.repository?.full_name;
  const client =
    githubClient ??
    createGitHubClient({
      token: process.env.GITHUB_TOKEN,
      repository,
    });
  const resolved = await resolveWorkflowRunEvent({
    event: rawEvent,
    manualForkApproval,
    sourceRunId,
    repository,
    client,
  });
  const event = resolved.event;
  const context = extractWorkflowRunContext(event);
  let result;
  try {
    const latestRun = await client.getLatestPullRequestCiRun(
      context.prNumber,
      context.headSha,
    );
    if (
      latestRun.id !== context.runId ||
      latestRun.run_attempt !== context.runAttempt
    ) {
      result = buildStaleResult(
        context,
        "同一HEADに新しいPull Request CI runまたはattemptがあるため公開しません",
      );
    } else {
      const pullRequest = await client.getPullRequest(context.prNumber);
      const currentHeadSha = pullRequest?.head?.sha;
      if (!/^[0-9a-f]{40}$/.test(currentHeadSha ?? "")) {
        throw new Error("GitHub APIからPRのcurrent HEAD SHAを確認できません");
      }
      if (context.conclusion === "success" && currentHeadSha === context.headSha) {
        await client.setDemoStatus(context.headSha, {
          state: "pending",
          description: "最新HEADの動作ビデオを検証しています",
          targetUrl: context.runUrl,
        });
      }
      let trustedDecision;
      if (
        context.conclusion === "success" &&
        currentHeadSha === context.headSha &&
        (context.sameRepository || resolved.forkApproved)
      ) {
        const changedFiles = await client.getPullRequestFiles(context.prNumber);
        trustedDecision = createDecision(
          {
            number: context.prNumber,
            repository: { full_name: repository },
            pull_request: pullRequest,
          },
          changedFiles,
        );
      }
      result = await preparePublish({
        event,
        currentHeadSha,
        forkApproved: resolved.forkApproved,
        trustedDecision,
        artifactDirectory,
        siteDirectory,
        pagesBaseUrl,
      });
    }
  } catch (error) {
    result = buildFailureResult(context, error.message);
  }
  result = await removePublishedDemoForResult({ result, siteDirectory });

  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  await writeOutputs(githubOutputPath, result);
  console.log(`[pr-demo] publish outcome=${result.outcome} reason=${result.reason}`);
  return result;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
