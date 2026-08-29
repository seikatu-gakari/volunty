import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { main } from "./finalize-publish.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);

test("handoff fileがなくてもtrusted eventから最新HEADを解決してfailureにする", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-finalize-"));
  const eventPath = join(directory, "event.json");
  await writeFile(
    eventPath,
    JSON.stringify({
      repository: { full_name: repository },
      workflow_run: {
        id: 987,
        run_attempt: 1,
        name: "Pull Request CI",
        event: "pull_request",
        conclusion: "success",
        head_sha: headSha,
        head_repository: { full_name: repository },
        html_url: `https://github.com/${repository}/actions/runs/987`,
        pull_requests: [{ number: 321, head: { sha: headSha } }],
      },
    }),
  );
  const calls = [];

  await assert.rejects(
    main({
      resultPath: join(directory, "missing-result.json"),
      eventPath,
      token: "test-token",
      repository,
      githubClient: {
        async getLatestPullRequestCiRun() {
          return { id: 987, run_attempt: 1 };
        },
        async getPullRequest() {
          return { head: { sha: headSha } };
        },
        async upsertDemoComment(prNumber, body) {
          calls.push({ type: "comment", prNumber, body });
        },
        async setDemoStatus(sha, status) {
          calls.push({ type: "status", sha, status });
        },
      },
    }),
    /demo-videoをfailure/,
  );

  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.match(calls[0].body, /handoff/);
  assert.equal(calls[1].sha, headSha);
  assert.equal(calls[1].status.state, "failure");
});

test("手動run APIとhandoffの両方が失敗してもmaintainer入力HEADをfailureにする", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-manual-finalize-"));
  const eventPath = join(directory, "event.json");
  await writeFile(
    eventPath,
    JSON.stringify({ repository: { full_name: repository } }),
  );
  const calls = [];

  await assert.rejects(
    main({
      resultPath: join(directory, "missing-result.json"),
      eventPath,
      token: "test-token",
      repository,
      manualForkApproval: true,
      sourceRunId: "987",
      sourceRunAttempt: "1",
      manualPrNumber: "321",
      manualHeadSha: headSha,
      githubClient: {
        async getWorkflowRun() {
          throw new Error("temporary GitHub API failure");
        },
        async getWorkflowRunPullRequests() {
          throw new Error("temporary GitHub API failure");
        },
        async upsertDemoComment(prNumber, body) {
          calls.push({ type: "comment", prNumber, body });
        },
        async setDemoStatus(sha, status) {
          calls.push({ type: "status", sha, status });
        },
      },
    }),
    /demo-videoをfailure/,
  );

  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.equal(calls[0].prNumber, 321);
  assert.equal(calls[1].sha, headSha);
  assert.equal(calls[1].status.state, "failure");
});

test("手動run解決失敗resultはAPI再照合不能でもfailure statusを確定する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-manual-result-"));
  const resultPath = join(directory, "result.json");
  await writeFile(
    resultPath,
    JSON.stringify({
      schemaVersion: 1,
      outcome: "failure",
      siteChanged: false,
      manualFallback: true,
      prNumber: 321,
      headSha,
      repository,
      runId: 987,
      runAttempt: 1,
      runUrl: `https://github.com/${repository}/actions/runs/987`,
      reason: "手動承認runを解決できませんでした",
    }),
  );
  const calls = [];

  await assert.rejects(
    main({
      resultPath,
      token: "test-token",
      repository,
      manualForkApproval: true,
      sourceRunId: "987",
      sourceRunAttempt: "1",
      manualPrNumber: "321",
      manualHeadSha: headSha,
      githubClient: {
        async getPullRequest() {
          throw new Error("temporary GitHub API failure");
        },
        async upsertDemoComment(prNumber, body) {
          calls.push({ type: "comment", prNumber, body });
        },
        async setDemoStatus(sha, status) {
          calls.push({ type: "status", sha, status });
        },
      },
    }),
    /demo-videoをfailure/,
  );

  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.equal(calls[1].status.state, "failure");
});

test("手動fallbackより新しい同一HEADのrunがあればstaleとしてfailureを上書きしない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-manual-stale-"));
  const resultPath = join(directory, "result.json");
  await writeFile(
    resultPath,
    JSON.stringify({
      schemaVersion: 1,
      outcome: "failure",
      siteChanged: false,
      manualFallback: true,
      prNumber: 321,
      headSha,
      repository,
      runId: 987,
      runAttempt: 1,
      runUrl: `https://github.com/${repository}/actions/runs/987`,
      reason: "手動承認runを解決できませんでした",
    }),
  );
  const writes = [];

  const outcome = await main({
    resultPath,
    token: "test-token",
    repository,
    manualForkApproval: true,
    sourceRunId: "987",
    sourceRunAttempt: "1",
    manualPrNumber: "321",
    manualHeadSha: headSha,
    githubClient: {
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async getLatestPullRequestCiRun() {
        return { id: 988, run_attempt: 1, status: "completed" };
      },
      async upsertDemoComment(...args) {
        writes.push({ type: "comment", args });
      },
      async setDemoStatus(...args) {
        writes.push({ type: "status", args });
      },
    },
  });

  assert.equal(outcome.state, "stale");
  assert.deepEqual(writes, []);
});

test("status更新中に新CIが始まった場合は最新runへpendingを復元する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-finalize-race-"));
  const resultPath = join(directory, "result.json");
  await writeFile(
    resultPath,
    JSON.stringify({
      schemaVersion: 1,
      outcome: "skip",
      siteChanged: false,
      prNumber: 321,
      headSha,
      repository,
      runId: 987,
      runAttempt: 1,
      runUrl: `https://github.com/${repository}/actions/runs/987`,
      reason: "動作ビデオ対象外",
    }),
  );
  let latestRunCalls = 0;
  const statuses = [];

  const outcome = await main({
    resultPath,
    token: "test-token",
    repository,
    githubClient: {
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async getLatestPullRequestCiRun() {
        latestRunCalls += 1;
        return latestRunCalls === 1
          ? { id: 987, run_attempt: 1, status: "completed" }
          : { id: 988, run_attempt: 1, status: "in_progress" };
      },
      async upsertDemoComment() {},
      async setDemoStatus(sha, status) {
        statuses.push({ sha, status });
      },
    },
  });

  assert.equal(outcome.state, "pending");
  assert.equal(latestRunCalls, 2);
  assert.deepEqual(statuses.map(({ status }) => status.state), ["success", "pending"]);
  assert.equal(
    statuses[1].status.targetUrl,
    `https://github.com/${repository}/actions/runs/988`,
  );
});
