import assert from "node:assert/strict";
import test from "node:test";

import { invalidateDemoStatus } from "./invalidate-status.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);
const runUrl = `https://github.com/${repository}/actions/runs/987`;

function workflowRunEvent(overrides = {}) {
  return {
    action: "in_progress",
    repository: { full_name: repository },
    workflow_run: {
      id: 987,
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

test("fork由来CIは書き込みを行わずmaintainer承認待ちにする", async () => {
  let statusCalls = 0;

  const outcome = await invalidateDemoStatus({
    event: workflowRunEvent({
      head_repository: { full_name: "someone/volunty" },
    }),
    client: {
      async setDemoStatus() {
        statusCalls += 1;
      },
    },
  });

  assert.equal(outcome, "fork");
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
