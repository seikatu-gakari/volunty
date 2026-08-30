import assert from "node:assert/strict";
import test from "node:test";

import {
  baseContainsTrustedPublisher,
  main,
  waitForDemoInvalidation,
} from "./wait-for-invalidation.mjs";

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

test("baseにtrusted publisherがない初回導入PRだけ待機をskipする", async () => {
  const baseSha = "a".repeat(40);
  const gitCalls = [];
  const result = await main({
    token: "test-token",
    repository,
    headSha,
    baseSha,
    sourceRunId: "987",
    sourceRunAttempt: "1",
    gitRunner: async (args) => {
      gitCalls.push(args);
      if (args[2].includes(":")) {
        const error = new Error("path does not exist");
        error.code = 128;
        throw error;
      }
    },
    githubClient: {
      async getLatestDemoStatus() {
        throw new Error("bootstrapではstatus APIを呼びません");
      },
    },
  });

  assert.deepEqual(result, { state: "bootstrap-skip" });
  assert.deepEqual(gitCalls, [
    ["cat-file", "-e", `${baseSha}^{commit}`],
    [
      "cat-file",
      "-e",
      `${baseSha}:.github/workflows/pr-demo-publish.yml`,
    ],
  ]);
});

test("base commitを確認できない場合は初回導入扱いにせずfail closedにする", async () => {
  await assert.rejects(
    baseContainsTrustedPublisher({
      baseSha: "a".repeat(40),
      gitRunner: async () => {
        const error = new Error("unknown revision");
        error.code = 128;
        throw error;
      },
    }),
    /base commitを確認できません/,
  );
});

test("baseにtrusted publisherがあれば現在runのpending待機を維持する", async () => {
  const result = await main({
    token: "test-token",
    repository,
    headSha,
    baseSha: "a".repeat(40),
    sourceRunId: "987",
    sourceRunAttempt: "1",
    gitRunner: async () => {},
    githubClient: {
      async getLatestDemoStatus(sha) {
        assert.equal(sha, headSha);
        return {
          id: 4,
          context: "demo-video",
          state: "pending",
          target_url: `https://github.com/${repository}/actions/runs/987`,
        };
      },
    },
  });

  assert.equal(result.id, 4);
});
