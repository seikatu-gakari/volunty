import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { main, resolveWorkflowRunEvent } from "./prepare-publish.mjs";
import { createDecision } from "./decision.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);
const baseSha = "a".repeat(40);

function failedWorkflowEvent() {
  return {
    repository: { full_name: repository },
    workflow_run: {
      id: 987,
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
      async getPullRequest() {
        return { head: { sha: "c".repeat(40) } };
      },
    },
  });

  assert.equal(result.outcome, "stale");
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
