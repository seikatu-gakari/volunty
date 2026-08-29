import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MAX_ARCHIVE_BYTES,
  downloadArtifactForRun,
  safelyExtractArchive,
  selectArtifactMetadata,
} from "./download-artifact.mjs";

function createZip(path, mode) {
  execFileSync("python3", [
    "-c",
    `import stat, sys, zipfile
path, mode = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    if mode == "normal":
        archive.writestr("decision.json", '{"schemaVersion":1}')
    elif mode == "oversized":
        archive.writestr("decision.json", '{"schemaVersion":1}')
        archive.writestr("desktop.mp4", b"0" * (12 * 1024 * 1024 + 1))
    elif mode == "traversal":
        archive.writestr("decision.json", '{"schemaVersion":1}')
        archive.writestr("../decision.json", "{}")
    elif mode == "symlink":
        archive.writestr("decision.json", '{"schemaVersion":1}')
        info = zipfile.ZipInfo("manifest.json")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        archive.writestr(info, "/etc/passwd")
`,
    path,
    mode,
  ]);
}

test("run artifactはpr-demo-resultsが1件かつ圧縮size上限内だけ受理する", () => {
  const artifact = selectArtifactMetadata([
    {
      id: 123,
      name: "pr-demo-results",
      expired: false,
      size_in_bytes: 1024,
    },
    { id: 456, name: "playwright-results", expired: false, size_in_bytes: 2048 },
  ]);
  assert.equal(artifact.id, 123);

  assert.throws(
    () =>
      selectArtifactMetadata([
        artifact,
        { ...artifact, id: 124 },
      ]),
    /正確に1件/,
  );
  assert.throws(
    () => selectArtifactMetadata([{ ...artifact, expired: true }]),
    /期限切れ状態/,
  );
  assert.throws(
    () => selectArtifactMetadata([{ ...artifact, size_in_bytes: MAX_ARCHIVE_BYTES + 1 }]),
    /圧縮size/,
  );
});

test("metadataの圧縮sizeが上限超過ならarchiveをdownloadしない", async () => {
  let downloaded = false;
  const root = await mkdtemp(join(tmpdir(), "volunty-pr-demo-preflight-"));
  await assert.rejects(
    downloadArtifactForRun({
      runId: 987,
      archivePath: join(root, "artifact.zip"),
      artifactDirectory: join(root, "artifact"),
      client: {
        async getWorkflowRunArtifacts() {
          return [
            {
              id: 123,
              name: "pr-demo-results",
              expired: false,
              size_in_bytes: MAX_ARCHIVE_BYTES + 1,
            },
          ];
        },
        async downloadArtifactArchive() {
          downloaded = true;
        },
      },
    }),
    /圧縮size/,
  );
  assert.equal(downloaded, false);
});

test("許可fileだけのZIPを固定名へ安全に展開する", async () => {
  const root = await mkdtemp(join(tmpdir(), "volunty-pr-demo-safe-zip-"));
  const archivePath = join(root, "artifact.zip");
  const destination = join(root, "artifact");
  createZip(archivePath, "normal");

  const entries = await safelyExtractArchive({ archivePath, destination });

  assert.deepEqual(entries, ["decision.json"]);
  assert.equal(JSON.parse(await readFile(join(destination, "decision.json"), "utf8")).schemaVersion, 1);
});

test("圧縮時は小さくても展開後上限を超えるZIP bombを展開前に拒否する", async () => {
  const root = await mkdtemp(join(tmpdir(), "volunty-pr-demo-zip-bomb-"));
  const archivePath = join(root, "artifact.zip");
  createZip(archivePath, "oversized");
  assert.equal((await stat(archivePath)).size < 100 * 1024, true);

  await assert.rejects(
    safelyExtractArchive({ archivePath, destination: join(root, "artifact") }),
    /許可size|圧縮率/,
  );
});

test("path traversalとsymlink entryを拒否する", async () => {
  for (const mode of ["traversal", "symlink"]) {
    const root = await mkdtemp(join(tmpdir(), `volunty-pr-demo-${mode}-`));
    const archivePath = join(root, "artifact.zip");
    createZip(archivePath, mode);
    await assert.rejects(
      safelyExtractArchive({ archivePath, destination: join(root, "artifact") }),
      /未許可entry|symlink/,
    );
  }
});
