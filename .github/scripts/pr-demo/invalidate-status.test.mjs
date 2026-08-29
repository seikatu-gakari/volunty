import assert from "node:assert/strict";
import test from "node:test";

import {
  invalidateDemoStatus,
  invalidateDemoStatusWithRetry,
} from "./invalidate-status.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);
const runUrl = `https://github.com/${repository}/actions/runs/987`;

function workflowRunEvent(overrides = {}) {
  return {
    action: "in_progress",
    repository: { full_name: repository },
    workflow_run: {
      id: 987,
      run_attempt: 1,
      name: "Pull Request CI",
      event: "pull_request",
      status: "in_progress",
      conclusion: null,
      head_sha: headSha,
      head_repository: { full_name: repository },
      html_url: runUrl,
      pull_requests: [{ number: 321, head: { sha: headSha } }],
      ...overrides,
    },
  };
}

test("trustedな同一repository CIの開始時に旧demo-video successをpendingへ戻す", async () => {
  const statuses = [];

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent(),
    client: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 1, status: "in_progress" };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async setDemoStatus(sha, status) {
        statuses.push({ sha, status });
      },
    },
  });

  assert.equal(outcome, "pending");
  assert.deepEqual(statuses, [
    {
      sha: headSha,
      status: {
        state: "pending",
        description: "最新CIの動作ビデオを待機しています",
        targetUrl: runUrl,
      },
    },
  ]);
});

test("fork由来CIの開始時も手動承認済みの旧successをpendingへ戻す", async () => {
  const statuses = [];

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent({
      head_repository: { full_name: "someone/volunty" },
    }),
    client: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 1, status: "in_progress" };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async setDemoStatus(sha, status) {
        statuses.push({ sha, status });
      },
    },
  });

  assert.equal(outcome, "pending");
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].sha, headSha);
  assert.equal(statuses[0].status.state, "pending");
});

test("最新CI完了後に古いrunを再実行してもdemo-video statusを上書きしない", async () => {
  let statusCalls = 0;

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent(),
    client: {
      async getLatestPullRequestCiRun() {
        return { id: 988, run_attempt: 1, status: "completed" };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async setDemoStatus() {
        statusCalls += 1;
      },
    },
  });

  assert.equal(outcome, "stale");
  assert.equal(statusCalls, 0);
});

test("同じrunの遅延invalidatorはCI完了後のsuccessをpendingへ戻さない", async () => {
  let statusCalls = 0;

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent(),
    client: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 1, status: "completed" };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async setDemoStatus() {
        statusCalls += 1;
      },
    },
  });

  assert.equal(outcome, "stale");
  assert.equal(statusCalls, 0);
});

test("lock待機中に古くなったinvalidatorは実行中の最新CIをpendingへ同期する", async () => {
  const statuses = [];

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent(),
    client: {
      async getLatestPullRequestCiRun() {
        return { id: 988, run_attempt: 2, status: "in_progress" };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async setDemoStatus(sha, status) {
        statuses.push({ sha, status });
      },
    },
  });

  assert.equal(outcome, "pending-latest");
  assert.deepEqual(statuses, [
    {
      sha: headSha,
      status: {
        state: "pending",
        description: "最新CIの動作ビデオを待機しています",
        targetUrl: `https://github.com/${repository}/actions/runs/988/attempts/2`,
      },
    },
  ]);
});

test("同じrun IDでも古いattemptはdemo-video statusを上書きしない", async () => {
  let statusCalls = 0;

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent({ run_attempt: 1 }),
    client: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 2 };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async setDemoStatus() {
        statusCalls += 1;
      },
    },
  });

  assert.equal(outcome, "stale");
  assert.equal(statusCalls, 0);
});

test("CI開始後にPR HEADが進んだ場合は古いSHAのstatusを更新しない", async () => {
  let statusCalls = 0;

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent(),
    client: {
      async getLatestPullRequestCiRun() {
        return { id: 987, run_attempt: 1 };
      },
      async getPullRequest() {
        return { head: { sha: "c".repeat(40) } };
      },
      async setDemoStatus() {
        statusCalls += 1;
      },
    },
  });

  assert.equal(outcome, "stale");
  assert.equal(statusCalls, 0);
});

test("in_progress以外のeventではstatusを更新しない", async () => {
  let statusCalls = 0;

  const outcome = await invalidateDemoStatus({
    event: { ...workflowRunEvent(), action: "completed" },
    client: {
      async setDemoStatus() {
        statusCalls += 1;
      },
    },
  });

  assert.equal(outcome, "ignored");
  assert.equal(statusCalls, 0);
});

test("一時的なGitHub API失敗後も再試行して旧successをpendingへ戻す", async () => {
  let latestRunCalls = 0;
  const retryDelays = [];
  const statuses = [];

  const outcome = await invalidateDemoStatusWithRetry({
    event: workflowRunEvent(),
    client: {
      async getLatestPullRequestCiRun() {
        latestRunCalls += 1;
        if (latestRunCalls < 3) {
          throw new Error("temporary GitHub API failure");
        }
        return { id: 987, run_attempt: 1, status: "in_progress" };
      },
      async getPullRequest() {
        return { head: { sha: headSha } };
      },
      async setDemoStatus(sha, status) {
        statuses.push({ sha, status });
      },
    },
    attempts: 3,
    sleep: async (milliseconds) => {
      retryDelays.push(milliseconds);
    },
  });

  assert.equal(outcome, "pending");
  assert.equal(latestRunCalls, 3);
  assert.deepEqual(retryDelays, [1000, 2000]);
  assert.equal(statuses.length, 1);
});
