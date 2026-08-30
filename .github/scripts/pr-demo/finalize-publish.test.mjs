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
  assert.equal(calls[0].prNumber, 321);
  assert.equal(calls[1].sha, headSha);
  assert.equal(calls[1].status.state, "failure");
});

test("handoff欠落時の手動fallbackも後続runがあればstaleとして上書きしない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-manual-handoff-stale-"));
  const eventPath = join(directory, "event.json");
  await writeFile(
    eventPath,
    JSON.stringify({ repository: { full_name: repository } }),
  );
  const writes = [];

  const outcome = await main({
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
        throw new Error("temporary workflow run API failure");
      },
      async getWorkflowRunPullRequests() {
        throw new Error("temporary workflow run API failure");
      },
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

test("finalizer初回freshness照会の一時障害を指数backoffで再試行する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-initial-freshness-"));
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
  let pullRequestCalls = 0;
  let latestRunCalls = 0;
  const sleeps = [];
  const statuses = [];

  const outcome = await main({
    resultPath,
    token: "test-token",
    repository,
    freshnessAttempts: 3,
    freshnessSleep: async (milliseconds) => sleeps.push(milliseconds),
    githubClient: {
      async getPullRequest() {
        pullRequestCalls += 1;
        if (pullRequestCalls <= 2) {
          throw new Error("temporary initial freshness API failure");
        }
        return { head: { sha: headSha } };
      },
      async getLatestPullRequestCiRun() {
        latestRunCalls += 1;
        return { id: 987, run_attempt: 1, status: "completed" };
      },
      async upsertDemoComment() {},
      async setDemoStatus(sha, status) {
        statuses.push({ sha, status });
      },
    },
  });

  assert.equal(outcome.state, "success");
  assert.equal(pullRequestCalls, 4);
  assert.equal(latestRunCalls, 2);
  assert.deepEqual(sleeps, [1000, 2000]);
  assert.deepEqual(statuses.map(({ status }) => status.state), ["success"]);
});

test("finalizer初回freshness照会の恒久障害は既存statusを上書きしない", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-initial-failure-"));
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
  let pullRequestCalls = 0;
  const sleeps = [];
  const writes = [];

  await assert.rejects(
    main({
      resultPath,
      token: "test-token",
      repository,
      freshnessSleep: async (milliseconds) => sleeps.push(milliseconds),
      githubClient: {
        async getPullRequest() {
          pullRequestCalls += 1;
          throw new Error("persistent initial freshness API failure");
        },
        async upsertDemoComment(prNumber, body) {
          writes.push({ type: "comment", prNumber, body });
        },
        async setDemoStatus(sha, status) {
          writes.push({ type: "status", sha, status });
        },
      },
    }),
    /最新性を確認できないためdemo-video statusを変更しません/,
  );

  assert.equal(pullRequestCalls, 6);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000, 16_000]);
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

test("success後の最終再照会失敗はfailureへ戻してfail closedにする", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-finalize-api-race-"));
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
  let pullRequestCalls = 0;
  const statuses = [];

  await assert.rejects(
    main({
      resultPath,
      token: "test-token",
      repository,
      githubClient: {
        async getPullRequest() {
          pullRequestCalls += 1;
          if (pullRequestCalls === 2) {
            throw new Error("temporary final freshness API failure");
          }
          return { head: { sha: headSha } };
        },
        async getLatestPullRequestCiRun() {
          return { id: 987, run_attempt: 1, status: "completed" };
        },
        async upsertDemoComment() {},
        async setDemoStatus(sha, status) {
          statuses.push({ sha, status });
        },
      },
    }),
    /temporary final freshness API failure/,
  );

  assert.equal(pullRequestCalls, 2);
  assert.deepEqual(statuses.map(({ status }) => status.state), [
    "success",
    "failure",
  ]);
  assert.match(statuses[1].status.description, /最終確認/);
});
