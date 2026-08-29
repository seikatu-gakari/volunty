import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertSiteCapacity,
  CLEANUP_PENDING_FILE,
  installDemoOnSite,
  listPublishedDemos,
  preparePublicSiteDirectory,
  readPendingCleanup,
  removeDemoFromSite,
  validateSiteDirectory,
  writePendingCleanup,
} from "./site.mjs";

const headSha = "b".repeat(40);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "volunty-pr-demo-site-"));
  const artifactDirectory = join(root, "artifact");
  const siteDirectory = join(root, "site");
  await mkdir(artifactDirectory);
  await mkdir(join(siteDirectory, "pr", "321", "old-head"), { recursive: true });
  await writeFile(join(siteDirectory, "pr", "321", "old-head", "manifest.json"), "{}");

  const gif = Buffer.from("GIF89a-demo");
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypisom-demo"),
  ]);
  const describe = (file, buffer) => ({
    file,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
  const manifest = {
    schemaVersion: 1,
    prNumber: 321,
    headSha,
    repository: "seikatu-gakari/volunty",
    environment: "ci-local",
    generatedAt: "2026-08-29T00:05:00.000Z",
    spec: "e2e/example.spec.ts",
    tag: "@demo-221",
    viewports: ["desktop"],
    media: [
      {
        viewport: "desktop",
        durationSeconds: 20,
        gif: describe("desktop.gif", gif),
        mp4: describe("desktop.mp4", mp4),
      },
    ],
  };
  await writeFile(join(artifactDirectory, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(artifactDirectory, "desktop.gif"), gif);
  await writeFile(join(artifactDirectory, "desktop.mp4"), mp4);
  return { artifactDirectory, siteDirectory, manifest };
}

test("同じPRの旧HEADを置換して最新demoだけをPagesへ配置する", async () => {
  const { artifactDirectory, siteDirectory, manifest } = await fixture();

  const destination = await installDemoOnSite({
    artifactDirectory,
    siteDirectory,
    manifest,
  });

  assert.equal(destination, join(siteDirectory, "pr", "321", headSha));
  assert.equal(await readFile(join(destination, "desktop.gif"), "utf8"), "GIF89a-demo");
  await assert.rejects(readFile(join(siteDirectory, "pr", "321", "old-head", "manifest.json")));
  assert.match(await readFile(join(siteDirectory, "index.html"), "utf8"), /PR #321/);
  assert.equal(await readFile(join(siteDirectory, ".nojekyll"), "utf8"), "");
});

test("公開済みmanifestを一覧化し、PR単位で削除できる", async () => {
  const { artifactDirectory, siteDirectory, manifest } = await fixture();
  await installDemoOnSite({ artifactDirectory, siteDirectory, manifest });

  const demos = await listPublishedDemos(siteDirectory);
  assert.deepEqual(demos.map((demo) => [demo.prNumber, demo.headSha]), [[321, headSha]]);

  assert.equal(await removeDemoFromSite(siteDirectory, 321), true);
  assert.deepEqual(await listPublishedDemos(siteDirectory), []);
  assert.equal(await removeDemoFromSite(siteDirectory, 321), false);
});

test("生成済みPages treeのfile形式・hash・entryを再検証する", async () => {
  const { artifactDirectory, siteDirectory, manifest } = await fixture();
  await installDemoOnSite({ artifactDirectory, siteDirectory, manifest });

  const demos = await validateSiteDirectory(siteDirectory);
  assert.equal(demos[0].headSha, headSha);

  await writeFile(join(siteDirectory, "pr", "321", headSha, "desktop.gif"), "GIF89a-tampered");
  await assert.rejects(validateSiteDirectory(siteDirectory), /SHA-256|size/);
});

test("Pages tree内のsymlinkを拒否する", async () => {
  const { artifactDirectory, siteDirectory, manifest } = await fixture();
  await installDemoOnSite({ artifactDirectory, siteDirectory, manifest });
  await symlink("/etc/passwd", join(siteDirectory, "unexpected-link"));

  await assert.rejects(validateSiteDirectory(siteDirectory), /未許可|symlink/);
});

test("demo公開時は同じPRのcleanup再試行だけを解除する", async () => {
  const { artifactDirectory, siteDirectory, manifest } = await fixture();
  await writePendingCleanup(siteDirectory, [
    { prNumber: 321, headSha },
    { prNumber: 322, headSha: "c".repeat(40) },
  ]);

  await installDemoOnSite({ artifactDirectory, siteDirectory, manifest });

  assert.deepEqual(await readPendingCleanup(siteDirectory), [
    { prNumber: 322, headSha: "c".repeat(40) },
  ]);
});

test("Pages artifact用treeにはcleanup再試行stateを含めない", async () => {
  const { artifactDirectory, siteDirectory, manifest } = await fixture();
  const publicDirectory = join(siteDirectory, "..", "public-site");
  await installDemoOnSite({ artifactDirectory, siteDirectory, manifest });
  await writePendingCleanup(siteDirectory, [
    { prNumber: 322, headSha: "c".repeat(40) },
  ]);

  await preparePublicSiteDirectory({ siteDirectory, publicDirectory });

  assert.deepEqual(await listPublishedDemos(publicDirectory), [manifest]);
  await assert.rejects(
    readFile(join(publicDirectory, CLEANUP_PENDING_FILE), "utf8"),
    /ENOENT/,
  );
  assert.deepEqual(await readPendingCleanup(siteDirectory), [
    { prNumber: 322, headSha: "c".repeat(40) },
  ]);
});

test("不正なcleanup再試行stateをPages tree検証で拒否する", async () => {
  const { artifactDirectory, siteDirectory, manifest } = await fixture();
  await installDemoOnSite({ artifactDirectory, siteDirectory, manifest });
  await writeFile(
    join(siteDirectory, CLEANUP_PENDING_FILE),
    JSON.stringify({
      schemaVersion: 1,
      pending: [{ prNumber: 321, headSha: "../invalid" }],
    }),
  );

  await assert.rejects(validateSiteDirectory(siteDirectory), /cleanup再試行state/);
});

test("Pages公開量が安全margin 900MiBを超えるtreeを拒否する", () => {
  const demo = {
    media: [
      {
        gif: { bytes: 8 * 1024 * 1024 },
        mp4: { bytes: 12 * 1024 * 1024 },
      },
    ],
  };

  assert.doesNotThrow(() => assertSiteCapacity(Array.from({ length: 45 }, () => demo)));
  assert.throws(
    () => assertSiteCapacity(Array.from({ length: 46 }, () => demo)),
    /900MiB/,
  );
});
