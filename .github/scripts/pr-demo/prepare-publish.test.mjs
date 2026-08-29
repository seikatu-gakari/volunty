import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { main, resolveWorkflowRunEvent } from "./prepare-publish.mjs";
import { createDecision } from "./decision.mjs";
import { createGitHubClient } from "./github.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);
const baseSha = "a".repeat(40);

function failedWorkflowEvent() {
  return {
    repository: { full_name: repository },
    workflow_run: {
      id: 987,
      run_attempt: 1,
      name: "Pull Request CI",
      event: "pull_request",
      conclusion: "failure",
      head_sha: headSha,
      head_repository: { full_name: repository },
      html_url: `https://github.com/${repository}/actions/runs/987`,
      pull_requests: [{ number: 321, head: { sha: headSha } }],
    },
  };
}

test("workflow_dispatchは指定CI runをGitHub APIで解決しfork手動承認にする", async () => {
  const source = failedWorkflowEvent().workflow_run;
  source.head_repository = { full_name: "someone/volunty" };
  const resolved = await resolveWorkflowRunEvent({
    event: { repository: { full_name: repository } },
    manualForkApproval: true,
    sourceRunId: "987",
    repository,
    client: {
      async getWorkflowRun() {
        return { ...source, pull_requests: undefined };
      },
      async getWorkflowRunPullRequests() {
        return source.pull_requests;
      },
    },
  });

  assert.equal(resolved.event.workflow_run.id, 987);
  assert.equal(resolved.event.workflow_run.pull_requests[0].number, 321);
  assert.equal(resolved.forkApproved, true);
});

test("prepare CLIはartifactがないCI失敗でもfinalizer用resultを必ず書く", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-prepare-"));
  const eventPath = join(directory, "event.json");
  const resultPath = join(directory, "result.json");
  const outputPath = join(directory, "github-output.txt");
  await writeFile(eventPath, JSON.stringify(failedWorkflowEvent()));
  await writeFile(outputPath, "");

  const result = await main({
    eventPath,
    artifactDirectory: join(directory, "missing-artifact"),
    siteDirectory: join(directory, "missing-site"),
    resultPath,
    githubOutputPath: outputPath,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    githubClient: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 1 };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
    },
  });

  assert.equal(result.outcome, "failure");
  assert.equal(JSON.parse(await readFile(resultPath, "utf8")).headSha, headSha);
  assert.match(await readFile(outputPath, "utf8"), /outcome=failure/);
  assert.match(await readFile(outputPath, "utf8"), /site_changed=false/);
});

test("prepare CLIはGitHub上のcurrent HEADと異なるrunをstaleにする", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-stale-"));
  const event = failedWorkflowEvent();
  event.workflow_run.conclusion = "success";
  const eventPath = join(directory, "event.json");
  const resultPath = join(directory, "result.json");
  await writeFile(eventPath, JSON.stringify(event));

  const result = await main({
    eventPath,
    artifactDirectory: join(directory, "missing-artifact"),
    siteDirectory: join(directory, "missing-site"),
    resultPath,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    githubClient: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 1 };
      },
      async getPullRequest() {
        return { head: { sha: "c".repeat(40) } };
      },
    },
  });

  assert.equal(result.outcome, "stale");
});

test("同じHEADでも最新ではないPull Request CI runをstaleにする", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-old-run-"));
  const event = failedWorkflowEvent();
  event.workflow_run.conclusion = "success";
  const eventPath = join(directory, "event.json");
  const resultPath = join(directory, "result.json");
  await writeFile(eventPath, JSON.stringify(event));
  const calls = [];
  const githubClient = createGitHubClient({
    token: "test-token",
    repository,
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          total_count: 2,
          workflow_runs: [
            {
              id: 988,
              run_number: 52,
              run_attempt: 1,
              event: "pull_request",
              head_sha: headSha,
              pull_requests: [{ number: 321 }],
            },
            {
              id: 987,
              run_number: 51,
              run_attempt: 1,
              event: "pull_request",
              head_sha: headSha,
              pull_requests: [{ number: 321 }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const result = await main({
    eventPath,
    artifactDirectory: join(directory, "missing-artifact"),
    siteDirectory: join(directory, "missing-site"),
    resultPath,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    githubClient,
  });

  assert.equal(result.outcome, "stale");
  assert.equal(result.siteChanged, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /actions\/workflows\/ci\.yml\/runs/);
});

test("同じrun IDでも古いattemptのpublisherをstaleにする", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-old-attempt-"));
  const event = failedWorkflowEvent();
  event.workflow_run.conclusion = "success";
  event.workflow_run.run_attempt = 1;
  const eventPath = join(directory, "event.json");
  const resultPath = join(directory, "result.json");
  await writeFile(eventPath, JSON.stringify(event));

  const result = await main({
    eventPath,
    artifactDirectory: join(directory, "missing-artifact"),
    siteDirectory: join(directory, "missing-site"),
    resultPath,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    githubClient: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 2 };
      },
    },
  });

  assert.equal(result.outcome, "stale");
  assert.equal(result.runAttempt, 1);
});

test("最新Pull Request CIの照会失敗をfailure resultとして保存する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-run-api-failure-"));
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-run-api-site-"));
  const event = failedWorkflowEvent();
  event.workflow_run.conclusion = "success";
  const eventPath = join(directory, "event.json");
  const resultPath = join(directory, "result.json");
  await writeFile(eventPath, JSON.stringify(event));

  const result = await main({
    eventPath,
    artifactDirectory: join(directory, "missing-artifact"),
    siteDirectory,
    resultPath,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    githubClient: {
      async getLatestPullRequestCiRun() {
        throw new Error("temporary GitHub API failure");
      },
    },
  });

  assert.equal(result.outcome, "failure");
  assert.match(result.reason, /temporary GitHub API failure/);
  assert.equal(JSON.parse(await readFile(resultPath, "utf8")).outcome, "failure");
});

test("prepare CLIはlive PR metadataをmainのpolicyで再評価する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-trusted-policy-"));
  const artifactDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-trusted-artifact-"));
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-trusted-site-"));
  const eventPath = join(directory, "event.json");
  const resultPath = join(directory, "result.json");
  const pullRequest = {
    number: 321,
    body: `<!-- pr-demo:v1
required: false
spec:
tag:
viewports:
reason: ドキュメントのみ
-->`,
    labels: [],
    base: { sha: baseSha, repo: { full_name: repository } },
    head: { sha: headSha, repo: { full_name: repository } },
  };
  const event = failedWorkflowEvent();
  event.workflow_run.conclusion = "success";
  event.workflow_run.pull_requests[0].base = { sha: baseSha };
  await writeFile(eventPath, JSON.stringify(event));
  const decision = {
    ...createDecision(
      { number: 321, repository: { full_name: repository }, pull_request: pullRequest },
      ["docs/pr-demo-video.md"],
    ),
    evaluatedAt: "2026-08-29T00:00:00.000Z",
  };
  await writeFile(
    join(artifactDirectory, "decision.json"),
    `${JSON.stringify(decision)}\n`,
  );
  const statuses = [];

  const result = await main({
    eventPath,
    artifactDirectory,
    siteDirectory,
    resultPath,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    githubClient: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 1 };
      },
      async getPullRequest() {
        return pullRequest;
      },
      async getPullRequestFiles() {
        return ["docs/pr-demo-video.md"];
      },
      async setDemoStatus(sha, status) {
        statuses.push({ sha, status });
      },
    },
  });

  assert.equal(result.outcome, "skip");
  assert.match(result.reason, /ドキュメントのみ/);
  assert.equal(statuses[0].sha, headSha);
  assert.equal(statuses[0].status.state, "pending");
});
