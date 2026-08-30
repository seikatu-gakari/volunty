import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { cleanupExpiredDemos, finalizeExpiredComments } from "./cleanup.mjs";
import {
  readManualForkApprovals,
  recordManualForkApproval,
} from "./site.mjs";

const headSha = "b".repeat(40);

async function createPublishedDemo(prNumber, siteDirectory) {
  siteDirectory ??= await mkdtemp(join(tmpdir(), "volunty-pr-demo-cleanup-"));
  const directory = join(siteDirectory, "pr", String(prNumber), headSha);
  await mkdir(directory, { recursive: true });
  const gif = Buffer.from("GIF89a-cleanup-demo");
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypisom-cleanup-demo"),
  ]);
  const describe = (file, buffer) => ({
    file,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      prNumber,
      headSha,
      repository: "seikatu-gakari/volunty",
      environment: "ci-local",
      generatedAt: "2026-08-20T00:00:00.000Z",
      spec: "e2e/example.spec.ts",
      tag: "@demo-321",
      viewports: ["desktop"],
      media: [
        {
          viewport: "desktop",
          durationSeconds: 20,
          gif: describe("desktop.gif", gif),
          mp4: describe("desktop.mp4", mp4),
        },
      ],
    }),
  );
  await writeFile(join(directory, "desktop.gif"), gif);
  await writeFile(join(directory, "desktop.mp4"), mp4);
  return siteDirectory;
}

test("closeから7日経過したPRだけPagesから削除してcommentを期限切れにする", async () => {
  const siteDirectory = await createPublishedDemo(321);
  const comments = [];
  const result = await cleanupExpiredDemos({
    siteDirectory,
    now: new Date("2026-08-30T00:00:00.000Z"),
    client: {
      async getPullRequest() {
        return { state: "closed", closed_at: "2026-08-22T23:59:59.000Z" };
      },
      async upsertDemoComment(prNumber, body) {
        comments.push({ prNumber, body });
      },
    },
  });

  assert.deepEqual(result.removed, [321]);
  assert.equal(result.requiresDeployment, true);
  await assert.rejects(stat(join(siteDirectory, "pr", "321")), /ENOENT/);
  assert.equal(comments.length, 0);

  await finalizeExpiredComments({
    expired: result.expired,
    siteDirectory,
    sitePersisted: true,
    pagesDeployed: true,
    client: {
      async upsertDemoComment(prNumber, body) {
        comments.push({ prNumber, body });
      },
    },
  });
  assert.match(comments[0].body, /保存期間（7日）が終了/);
});

test("gh-pagesの永続化失敗時は期限切れcommentを更新しない", async () => {
  let commentCalls = 0;

  await assert.rejects(
    finalizeExpiredComments({
      expired: [{ prNumber: 321, headSha }],
      sitePersisted: false,
      client: {
        async upsertDemoComment() {
          commentCalls += 1;
        },
      },
    }),
    /gh-pages.*永続化/,
  );

  assert.equal(commentCalls, 0);
});

test("Pages deploy失敗時は期限切れcommentを更新しない", async () => {
  const siteDirectory = await createPublishedDemo(321);
  const result = await cleanupExpiredDemos({
    siteDirectory,
    now: new Date("2026-08-30T00:00:00.000Z"),
    client: {
      async getPullRequest() {
        return { state: "closed", closed_at: "2026-08-22T23:59:59.000Z" };
      },
    },
  });
  let commentCalls = 0;

  await assert.rejects(
    finalizeExpiredComments({
      expired: result.expired,
      siteDirectory,
      sitePersisted: true,
      pagesDeployed: false,
      client: {
        async upsertDemoComment() {
          commentCalls += 1;
        },
      },
    }),
    /Pages.*deploy/,
  );

  assert.equal(commentCalls, 0);
});

test("comment更新の途中失敗を次回cleanupで再試行し全件成功後に完了する", async () => {
  const siteDirectory = await createPublishedDemo(321);
  await createPublishedDemo(322, siteDirectory);
  const cleanupOptions = {
    siteDirectory,
    now: new Date("2026-08-30T00:00:00.000Z"),
    client: {
      async getPullRequest() {
        return { state: "closed", closed_at: "2026-08-22T23:59:59.000Z" };
      },
    },
  };
  const first = await cleanupExpiredDemos(cleanupOptions);
  const firstAttempts = [];

  await assert.rejects(
    finalizeExpiredComments({
      expired: first.expired,
      siteDirectory,
      sitePersisted: true,
      pagesDeployed: true,
      client: {
        async upsertDemoComment(prNumber) {
          firstAttempts.push(prNumber);
          if (prNumber === 322) {
            throw new Error("temporary GitHub API failure");
          }
        },
      },
    }),
    /temporary GitHub API failure/,
  );
  assert.deepEqual(firstAttempts, [321, 322]);

  const retry = await cleanupExpiredDemos(cleanupOptions);
  assert.deepEqual(retry.expired, first.expired);
  assert.equal(retry.requiresDeployment, true);
  await finalizeExpiredComments({
    expired: retry.expired,
    siteDirectory,
    sitePersisted: true,
    pagesDeployed: true,
    client: { async upsertDemoComment() {} },
  });

  const completed = await cleanupExpiredDemos(cleanupOptions);
  assert.deepEqual(completed.expired, []);
  assert.equal(completed.requiresDeployment, false);
});

test("open PRの最新HEAD動画は保持する", async () => {
  const siteDirectory = await createPublishedDemo(321);
  let commentCalls = 0;
  const result = await cleanupExpiredDemos({
    siteDirectory,
    now: new Date("2026-08-30T00:00:00.000Z"),
    client: {
      async getPullRequest() {
        return { state: "open", closed_at: null };
      },
      async upsertDemoComment() {
        commentCalls += 1;
      },
    },
  });

  assert.deepEqual(result.removed, []);
  assert.equal(commentCalls, 0);
  assert.equal((await stat(join(siteDirectory, "pr", "321"))).isDirectory(), true);
});

test("動画がない対象外forkの手動承認stateもcloseから7日後に削除する", async () => {
  const siteDirectory = await mkdtemp(
    join(tmpdir(), "volunty-pr-demo-approval-cleanup-"),
  );
  await recordManualForkApproval(siteDirectory, {
    prNumber: 321,
    headSha,
    runId: 987,
    runAttempt: 1,
  });

  const result = await cleanupExpiredDemos({
    siteDirectory,
    now: new Date("2026-08-30T00:00:00.000Z"),
    client: {
      async getPullRequest() {
        return { state: "closed", closed_at: "2026-08-22T23:59:59.000Z" };
      },
    },
  });

  assert.deepEqual(result.removed, [321]);
  assert.deepEqual(result.expired, []);
  assert.equal(result.requiresDeployment, true);
  assert.deepEqual(await readManualForkApprovals(siteDirectory), []);
});

test("cleanup前にPages tree全体を検証してsymlinkを拒否する", async () => {
  const siteDirectory = await createPublishedDemo(321);
  await symlink("/etc/passwd", join(siteDirectory, "unexpected-link"));

  await assert.rejects(
    cleanupExpiredDemos({
      siteDirectory,
      now: new Date("2026-08-30T00:00:00.000Z"),
      client: { async getPullRequest() { return { state: "open", closed_at: null }; } },
    }),
    /未許可entry|symlink/,
  );
});
