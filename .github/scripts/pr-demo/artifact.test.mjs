import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  buildDemoComment,
  buildExpiredComment,
  buildFailureComment,
  shouldExpireDemo,
  validateArtifactDirectory,
} from "./artifact.mjs";
import { createTestMedia } from "./test-media-helper.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);
const testMedia = await createTestMedia();
after(testMedia.cleanup);
const gif = testMedia.gif;
const mp4 = testMedia.mp4;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function createArtifact(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-artifact-"));
  const decision = {
    schemaVersion: 1,
    outcome: "capture",
    required: true,
    uiChange: true,
    reason: "変更点を示す動作ビデオを生成します",
    contract: {
      version: 1,
      required: true,
      spec: "e2e/participant-discovery.spec.ts",
      tag: "@demo-221",
      viewports: ["desktop"],
      reason: "",
    },
    prNumber: 321,
    baseSha: "a".repeat(40),
    headSha,
    baseRepository: repository,
    headRepository: repository,
    changedFiles: ["app/src/app/page.tsx"],
    evaluatedAt: "2026-08-29T00:00:00.000Z",
    ...overrides.decision,
  };
  const manifest = {
    schemaVersion: 1,
    prNumber: 321,
    headSha,
    repository,
    environment: "ci-local",
    generatedAt: "2026-08-29T00:05:00.000Z",
    spec: "e2e/participant-discovery.spec.ts",
    tag: "@demo-221",
    viewports: ["desktop"],
    media: [
      {
        viewport: "desktop",
        durationSeconds: testMedia.durationSeconds,
        gif: { file: "desktop.gif", bytes: gif.length, sha256: sha256(gif) },
        mp4: { file: "desktop.mp4", bytes: mp4.length, sha256: sha256(mp4) },
      },
    ],
    ...overrides.manifest,
  };

  await writeFile(join(directory, "decision.json"), JSON.stringify(decision));
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(directory, "desktop.gif"), overrides.gif ?? gif);
  await writeFile(join(directory, "desktop.mp4"), overrides.mp4 ?? mp4);
  return { directory, decision, manifest };
}

test("decision・manifest・mediaがtrusted eventと一致するartifactを受理する", async () => {
  const { directory } = await createArtifact();

  const result = await validateArtifactDirectory(directory, {
    prNumber: 321,
    headSha,
    repository,
  });

  assert.equal(result.manifest.media[0].durationSeconds, testMedia.durationSeconds);
  assert.equal(result.decision.contract.tag, "@demo-221");
});

test("artifactのHEAD SHA差し替えを拒否する", async () => {
  const { directory } = await createArtifact({
    manifest: { headSha: "c".repeat(40) },
  });

  await assert.rejects(
    validateArtifactDirectory(directory, {
      prNumber: 321,
      headSha,
      repository,
    }),
    /manifestのHEAD SHAがworkflow_runと一致しません/,
  );
});

test("mediaのhash不一致を拒否する", async () => {
  const tamperedGif = Buffer.from(gif);
  tamperedGif[tamperedGif.length - 1] ^= 0xff;
  const { directory } = await createArtifact({ gif: tamperedGif });

  await assert.rejects(
    validateArtifactDirectory(directory, {
      prNumber: 321,
      headSha,
      repository,
    }),
    /desktop.gifのSHA-256が一致しません/,
  );
});

test("viewportごとにmediaが正確に1件ないartifactを拒否する", async () => {
  const desktopMedia = {
    viewport: "desktop",
    durationSeconds: testMedia.durationSeconds,
    gif: { file: "desktop.gif", bytes: gif.length, sha256: sha256(gif) },
    mp4: { file: "desktop.mp4", bytes: mp4.length, sha256: sha256(mp4) },
  };
  const { directory } = await createArtifact({
    decision: {
      contract: {
        version: 1,
        required: true,
        spec: "e2e/participant-discovery.spec.ts",
        tag: "@demo-221",
        viewports: ["desktop", "mobile"],
        reason: "",
      },
    },
    manifest: {
      viewports: ["desktop", "mobile"],
      media: [desktopMedia, desktopMedia],
    },
  });

  await assert.rejects(
    validateArtifactDirectory(directory, {
      prNumber: 321,
      headSha,
      repository,
    }),
    /viewportごとにmediaを1件だけ指定してください/,
  );
});

test("commentへ注入できるscenario文字列を再検証して拒否する", async () => {
  const injectedTag = "@demo-221\n![injected](https://example.com/x.gif)";
  const { directory } = await createArtifact({
    decision: {
      contract: {
        version: 1,
        required: true,
        spec: "e2e/participant-discovery.spec.ts",
        tag: injectedTag,
        viewports: ["desktop"],
        reason: "",
      },
    },
    manifest: { tag: injectedTag },
  });

  await assert.rejects(
    validateArtifactDirectory(directory, {
      prNumber: 321,
      headSha,
      repository,
    }),
    /scenarioの形式が不正です/,
  );
});

test("PRコメントはSHA固有URLとCIローカル表記を含む", async () => {
  const { directory } = await createArtifact();
  const { manifest } = await validateArtifactDirectory(directory, {
    prNumber: 321,
    headSha,
    repository,
  });

  const comment = buildDemoComment(
    manifest,
    "https://seikatu-gakari.github.io/volunty",
  );

  assert.match(comment, /<!-- pr-demo-comment:v1 -->/);
  assert.match(comment, /pr\/321\/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\/desktop\.gif/);
  assert.match(comment, /CIローカル環境/);
  assert.match(comment, /@demo-221/);
});

test("closeから7日後だけ期限切れにする", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");

  assert.equal(
    shouldExpireDemo({
      state: "closed",
      closedAt: "2026-08-22T11:59:59.000Z",
      now,
      retentionDays: 7,
    }),
    true,
  );
  assert.equal(
    shouldExpireDemo({
      state: "closed",
      closedAt: "2026-08-22T12:00:01.000Z",
      now,
      retentionDays: 7,
    }),
    false,
  );
  assert.equal(
    shouldExpireDemo({
      state: "open",
      closedAt: "2026-08-01T00:00:00.000Z",
      now,
      retentionDays: 7,
    }),
    false,
  );
});

test("期限切れコメントは動画リンクを残さない", () => {
  const comment = buildExpiredComment({ prNumber: 321, headSha });

  assert.match(comment, /保存期間（7日）が終了/);
  assert.doesNotMatch(comment, /\.gif|\.mp4/);
  assert.match(comment, /bbbbbbb/);
});

test("生成失敗コメントは最新HEADと理由を示す", () => {
  const comment = buildFailureComment({
    headSha,
    reason: "対象テストが0件でした",
    runUrl: "https://github.com/example/repository/actions/runs/1",
  });

  assert.match(comment, /動作ビデオを公開できませんでした/);
  assert.match(comment, /対象テストが0件でした/);
  assert.match(comment, /Actions run/);
  assert.match(comment, /bbbbbbb/);
});

test("生成失敗理由をMarkdown linkとして解釈させない", () => {
  const comment = buildFailureComment({
    headSha,
    reason: "invalid file\n[click](https://attacker.example)",
    runUrl: "https://github.com/example/repository/actions/runs/1",
  });

  assert.doesNotMatch(comment, /\[click\]\(https:\/\/attacker\.example\)/);
  assert.match(comment, /\\\[click\\\]/);
});
