import assert from "node:assert/strict";
import test from "node:test";

import {
  acquirePagesLock,
  createPagesLockClient,
  formatLockMessage,
  parseLockMessage,
  releasePagesLock,
} from "./pages-lock.mjs";

const identity = {
  repository: "seikatu-gakari/volunty",
  runId: 987,
  runAttempt: 2,
};
const acquiredAt = new Date("2026-08-29T12:00:00.000Z");
const lock = {
  refId: "REF_lock_987",
  sha: "a".repeat(40),
  ...identity,
  acquiredAt,
};

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Pages lock commit metadataを厳格に往復する", () => {
  const message = formatLockMessage(identity, acquiredAt);

  assert.deepEqual(parseLockMessage(message), { ...identity, acquiredAt });
  assert.throws(
    () => parseLockMessage(`${message}\nextra:injection`),
    /metadataが不正/,
  );
});

test("GitHub refとcommit APIからlock所有者を検証する", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/git/ref/heads/pr-demo-pages-lock")) {
      return jsonResponse({
        ref: "refs/heads/pr-demo-pages-lock",
        node_id: lock.refId,
        object: { type: "commit", sha: lock.sha },
      });
    }
    if (url.endsWith(`/git/commits/${lock.sha}`)) {
      return jsonResponse({
        sha: lock.sha,
        message: formatLockMessage(identity, acquiredAt),
      });
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  const client = createPagesLockClient({
    token: "test-token",
    repository: identity.repository,
    fetchImpl,
  });

  assert.deepEqual(await client.getLock(), lock);
});

test("GitHub APIでlock refを原子的に作成してref ID指定で削除する", async () => {
  const mainSha = "d".repeat(40);
  const treeSha = "e".repeat(40);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/git/ref/heads/main")) {
      return jsonResponse({ object: { sha: mainSha } });
    }
    if (url.endsWith(`/git/commits/${mainSha}`)) {
      return jsonResponse({ sha: mainSha, tree: { sha: treeSha } });
    }
    if (url.endsWith("/git/commits") && options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.tree, treeSha);
      assert.deepEqual(body.parents, [mainSha]);
      return jsonResponse({ sha: lock.sha }, 201);
    }
    if (url.endsWith("/git/refs") && options.method === "POST") {
      return jsonResponse(
        {
          ref: "refs/heads/pr-demo-pages-lock",
          node_id: lock.refId,
          object: { sha: lock.sha },
        },
        201,
      );
    }
    if (url.endsWith("/graphql")) {
      const body = JSON.parse(options.body);
      assert.equal(body.variables.refId, lock.refId);
      return jsonResponse({ data: { deleteRef: { clientMutationId: null } } });
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  const client = createPagesLockClient({
    token: "test-token",
    repository: identity.repository,
    fetchImpl,
  });

  const created = await client.createLock(identity, acquiredAt);
  await client.deleteLock(created.refId);

  assert.equal(created.sha, lock.sha);
  assert.equal(calls.length, 5);
});

test("別の待機jobが先にstale lockを削除しても回収競合として継続する", async () => {
  const fetchImpl = async (url) => {
    assert.ok(url.endsWith("/graphql"));
    return jsonResponse({
      data: { deleteRef: null },
      errors: [
        {
          type: "NOT_FOUND",
          message: "Could not resolve to a node with the global id",
        },
      ],
    });
  };
  const client = createPagesLockClient({
    token: "test-token",
    repository: identity.repository,
    fetchImpl,
  });

  assert.equal(await client.deleteLock(lock.refId), "absent");
});

test("空いているPages lock refを取得する", async () => {
  const calls = [];
  const result = await acquirePagesLock({
    identity,
    client: {
      async getLock() {
        calls.push("get");
        return undefined;
      },
      async createLock(receivedIdentity, receivedAt) {
        calls.push("create");
        assert.deepEqual(receivedIdentity, identity);
        return { ...lock, acquiredAt: receivedAt };
      },
    },
    now: () => acquiredAt,
    sleep: async () => {},
    maxWaitMs: 1000,
    pollMs: 1,
  });

  assert.deepEqual(calls, ["get", "create"]);
  assert.equal(result.refId, lock.refId);
});

test("lock取得中のGitHub API一時障害を指数backoffで再試行する", async () => {
  let reads = 0;
  const sleeps = [];

  const result = await acquirePagesLock({
    identity,
    client: {
      async getLock() {
        reads += 1;
        if (reads <= 2) {
          throw new Error("temporary API failure");
        }
        return undefined;
      },
      async createLock() {
        return lock;
      },
    },
    now: () => acquiredAt,
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    maxWaitMs: 1000,
    pollMs: 1,
    apiRetryAttempts: 4,
  });

  assert.equal(result.refId, lock.refId);
  assert.equal(reads, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
});

test("lock作成応答を失っても次の所有者確認で取得済みlockを回収する", async () => {
  let existing;
  let creates = 0;
  const sleeps = [];

  const result = await acquirePagesLock({
    identity,
    client: {
      async getLock() {
        return existing;
      },
      async createLock() {
        creates += 1;
        existing = lock;
        throw new Error("response lost after create");
      },
    },
    now: () => acquiredAt,
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    maxWaitMs: 1000,
    pollMs: 1,
    apiRetryAttempts: 3,
  });

  assert.equal(result.refId, lock.refId);
  assert.equal(creates, 1);
  assert.deepEqual(sleeps, [1000]);
});

test("lock APIの恒久障害は有限回でfail closedにする", async () => {
  const sleeps = [];
  let reads = 0;

  await assert.rejects(
    acquirePagesLock({
      identity,
      client: {
        async getLock() {
          reads += 1;
          throw new Error("persistent API failure");
        },
      },
      now: () => acquiredAt,
      sleep: async (milliseconds) => sleeps.push(milliseconds),
      maxWaitMs: 1000,
      pollMs: 1,
    }),
    /Pages lock API操作が6回連続で失敗しました/,
  );

  assert.equal(reads, 6);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000, 16_000]);
});

test("60分ownerを上回る75分のlock待機上限を受理する", async () => {
  const result = await acquirePagesLock({
    identity,
    client: {
      async getLock() {
        return undefined;
      },
      async createLock() {
        return lock;
      },
    },
    now: () => acquiredAt,
    sleep: async () => {},
    maxWaitMs: 75 * 60 * 1000,
    pollMs: 1,
  });

  assert.equal(result.refId, lock.refId);
});

test("別runのlockが解放されるまでjobを失わず待機する", async () => {
  let reads = 0;
  const sleeps = [];
  const otherLock = {
    ...lock,
    refId: "REF_other",
    sha: "b".repeat(40),
    runId: 654,
    acquiredAt,
  };
  const clock = [
    acquiredAt,
    acquiredAt,
    new Date(acquiredAt.getTime() + 1000),
    new Date(acquiredAt.getTime() + 1000),
    new Date(acquiredAt.getTime() + 2000),
  ];

  const result = await acquirePagesLock({
    identity,
    client: {
      async getLock() {
        reads += 1;
        return reads === 1 ? otherLock : undefined;
      },
      async createLock() {
        return lock;
      },
    },
    now: () => clock.shift() ?? clock.at(-1) ?? acquiredAt,
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    maxWaitMs: 5000,
    pollMs: 25,
  });

  assert.equal(result.sha, lock.sha);
  assert.deepEqual(sleeps, [25]);
});

test("完了済みworkflowのstale lockだけを回収して再取得する", async () => {
  let existing = {
    ...lock,
    refId: "REF_stale",
    sha: "c".repeat(40),
    runId: 654,
    acquiredAt,
  };
  const deleted = [];
  const currentTime = new Date(acquiredAt.getTime() + 2 * 60 * 1000);

  const result = await acquirePagesLock({
    identity,
    client: {
      async getLock() {
        return existing;
      },
      async getWorkflowRun() {
        return { id: 654, run_attempt: 1, status: "completed" };
      },
      async deleteLock(refId) {
        deleted.push(refId);
        existing = undefined;
      },
      async createLock() {
        return lock;
      },
    },
    now: () => currentTime,
    sleep: async () => {},
    maxWaitMs: 1000,
    pollMs: 1,
  });

  assert.deepEqual(deleted, ["REF_stale"]);
  assert.equal(result.refId, lock.refId);
});

test("同じrun IDの新attemptは旧attemptのstale lockを回収する", async () => {
  let existing = {
    ...lock,
    refId: "REF_old_attempt",
    sha: "f".repeat(40),
    runAttempt: 1,
    acquiredAt,
  };
  const deleted = [];
  const currentTime = new Date(acquiredAt.getTime() + 2 * 60 * 1000);

  const result = await acquirePagesLock({
    identity,
    client: {
      async getLock() {
        return existing;
      },
      async getWorkflowRun() {
        return { id: identity.runId, run_attempt: 2, status: "in_progress" };
      },
      async deleteLock(refId) {
        deleted.push(refId);
        existing = undefined;
      },
      async createLock() {
        return lock;
      },
    },
    now: () => currentTime,
    sleep: async () => {
      throw new Error("新attemptは旧lockを待機してはいけません");
    },
    maxWaitMs: 1000,
    pollMs: 1,
  });

  assert.deepEqual(deleted, ["REF_old_attempt"]);
  assert.equal(result.runAttempt, identity.runAttempt);
});

test("所有runとref objectが完全一致するlockだけを解放する", async () => {
  const deleted = [];
  const outcome = await releasePagesLock({
    identity,
    expectedRefId: lock.refId,
    expectedSha: lock.sha,
    client: {
      async getLock() {
        return lock;
      },
      async deleteLock(refId) {
        deleted.push(refId);
      },
    },
  });

  assert.equal(outcome, "released");
  assert.deepEqual(deleted, [lock.refId]);
  await assert.rejects(
    releasePagesLock({
      identity,
      expectedRefId: "REF_attacker",
      expectedSha: lock.sha,
      client: { async getLock() { return lock; } },
    }),
    /別workflow/,
  );
});
