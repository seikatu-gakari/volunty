import assert from "node:assert/strict";
import test from "node:test";

import { waitForDemoInvalidation } from "./wait-for-invalidation.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);

test("現在run attempt向けpendingを確認するまで旧statusを受理しない", async () => {
  const statuses = [
    {
      id: 1,
      context: "demo-video",
      state: "success",
      target_url: "https://example.com/old-demo",
    },
    {
      id: 2,
      context: "demo-video",
      state: "pending",
      target_url: `https://github.com/${repository}/actions/runs/986`,
    },
    {
      id: 3,
      context: "demo-video",
      state: "pending",
      target_url: `https://github.com/${repository}/actions/runs/987/attempts/2`,
    },
  ];
  let nowMs = 0;
  const sleeps = [];

  const result = await waitForDemoInvalidation({
    repository,
    headSha,
    runId: 987,
    runAttempt: 2,
    client: {
      async getLatestDemoStatus(sha) {
        assert.equal(sha, headSha);
        return statuses.shift();
      },
    },
    timeoutMs: 1000,
    pollMs: 10,
    now: () => nowMs,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      nowMs += milliseconds;
    },
  });

  assert.equal(result.id, 3);
  assert.deepEqual(sleeps, [10, 10]);
});

test("status API一時障害は待機中に再試行する", async () => {
  let calls = 0;
  let nowMs = 0;

  const result = await waitForDemoInvalidation({
    repository,
    headSha,
    runId: 987,
    runAttempt: 1,
    client: {
      async getLatestDemoStatus() {
        calls += 1;
        if (calls === 1) {
          throw new Error("temporary API failure");
        }
        return {
          id: 2,
          context: "demo-video",
          state: "pending",
          target_url: `https://github.com/${repository}/actions/runs/987`,
        };
      },
    },
    timeoutMs: 1000,
    pollMs: 10,
    now: () => nowMs,
    sleep: async (milliseconds) => {
      nowMs += milliseconds;
    },
  });

  assert.equal(result.id, 2);
  assert.equal(calls, 2);
});

test("現在run向けpendingを期限内に確認できなければqualityをfail closedにする", async () => {
  let nowMs = 0;

  await assert.rejects(
    waitForDemoInvalidation({
      repository,
      headSha,
      runId: 987,
      runAttempt: 1,
      client: {
        async getLatestDemoStatus() {
          return undefined;
        },
      },
      timeoutMs: 20,
      pollMs: 10,
      now: () => nowMs,
      sleep: async (milliseconds) => {
        nowMs += milliseconds;
      },
    }),
    /現在のPull Request CI向けdemo-video pendingを確認できません/,
  );
});
