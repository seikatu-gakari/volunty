import { createHash } from "node:crypto";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { validateMediaContent } from "./media.mjs";

export const COMMENT_MARKER = "<!-- pr-demo-comment:v1 -->";
export const RETENTION_DAYS = 7;

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const VIEWPORTS = new Set(["desktop", "mobile"]);
const MAX_GIF_BYTES = 8 * 1024 * 1024;
const MAX_MP4_BYTES = 12 * 1024 * 1024;
const MIN_DURATION_SECONDS = 15;
const MAX_DURATION_SECONDS = 45;

async function readJson(path, label) {
  const metadata = await stat(path);
  if (metadata.size > 1024 * 1024) {
    throw new Error(`${label}が大きすぎます`);
  }

  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${label}をJSONとして読めません: ${error.message}`);
  }
}

function assertExpectedIdentity(value, expected) {
  if (value.prNumber !== expected.prNumber) {
    throw new Error(`${expected.label}のPR番号がworkflow_runと一致しません`);
  }
  if (value.headSha !== expected.headSha) {
    throw new Error(`${expected.label}のHEAD SHAがworkflow_runと一致しません`);
  }
}

function assertDecision(decision, expected) {
  if (decision.schemaVersion !== 1 || decision.outcome !== "capture") {
    throw new Error("decisionはcapture済みのschemaVersion 1である必要があります");
  }
  assertExpectedIdentity(decision, { ...expected, label: "decision" });
  if (
    decision.baseRepository !== expected.repository ||
    decision.headRepository !== (expected.headRepository ?? expected.repository)
  ) {
    throw new Error("decisionのrepositoryがworkflow_runと一致しません");
  }
  if (!decision.contract?.required) {
    throw new Error("decisionに録画対象contractがありません");
  }
}

function assertManifestShape(manifest, decision, expected) {
  if (manifest.schemaVersion !== 1 || manifest.environment !== "ci-local") {
    throw new Error("manifestはci-localのschemaVersion 1である必要があります");
  }
  assertExpectedIdentity(manifest, { ...expected, label: "manifest" });
  if (manifest.repository !== expected.repository) {
    throw new Error("manifestのrepositoryがworkflow_runと一致しません");
  }
  if (manifest.spec !== decision.contract.spec || manifest.tag !== decision.contract.tag) {
    throw new Error("manifestのscenarioがdecisionと一致しません");
  }
  if (
    !/^e2e\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(manifest.spec) ||
    manifest.spec.split("/").includes("..") ||
    !/^@demo-[1-9][0-9]*$/.test(manifest.tag)
  ) {
    throw new Error("manifestのscenarioの形式が不正です");
  }
  if (!Array.isArray(manifest.viewports) || manifest.viewports.length === 0) {
    throw new Error("manifestのviewportsが不正です");
  }
  if (
    manifest.viewports.some((viewport) => !VIEWPORTS.has(viewport)) ||
    new Set(manifest.viewports).size !== manifest.viewports.length ||
    JSON.stringify(manifest.viewports) !== JSON.stringify(decision.contract.viewports)
  ) {
    throw new Error("manifestのviewportsがdecisionと一致しません");
  }
  if (!Array.isArray(manifest.media) || manifest.media.length !== manifest.viewports.length) {
    throw new Error("manifestのmedia件数がviewportsと一致しません");
  }
  const mediaViewports = manifest.media.map((media) => media.viewport);
  if (
    new Set(mediaViewports).size !== mediaViewports.length ||
    !manifest.viewports.every((viewport) => mediaViewports.includes(viewport))
  ) {
    throw new Error("viewportごとにmediaを1件だけ指定してください");
  }
  if (Number.isNaN(Date.parse(manifest.generatedAt))) {
    throw new Error("manifestのgeneratedAtが不正です");
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function validateMediaFile(
  directory,
  descriptor,
  kind,
  viewport,
  durationSeconds,
) {
  const expectedFile = `${viewport}.${kind}`;
  if (descriptor?.file !== expectedFile) {
    throw new Error(`${viewport}の${kind} file名が不正です`);
  }

  const path = join(directory, expectedFile);
  const fileStat = await lstat(path);
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new Error(`${expectedFile}は通常fileである必要があります`);
  }

  const maxBytes = kind === "gif" ? MAX_GIF_BYTES : MAX_MP4_BYTES;
  if (fileStat.size <= 0 || fileStat.size > maxBytes || descriptor.bytes !== fileStat.size) {
    throw new Error(`${expectedFile}のsizeが不正です`);
  }

  const buffer = await readFile(path);
  const magicValid =
    kind === "gif"
      ? ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))
      : buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (!magicValid) {
    throw new Error(`${expectedFile}のfile形式が不正です`);
  }
  if (sha256(buffer) !== descriptor.sha256) {
    throw new Error(`${expectedFile}のSHA-256が一致しません`);
  }
  await validateMediaContent(path, { kind, viewport, durationSeconds });
}

async function assertOnlyAllowedFiles(directory, allowedFiles) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !allowedFiles.has(entry.name)) {
      throw new Error(`artifactに未許可のentryがあります: ${entry.name}`);
    }
  }
  if (entries.length !== allowedFiles.size) {
    throw new Error("artifactに必要なfileが不足しています");
  }
}

export async function validateArtifactDirectory(directory, expected) {
  if (
    !Number.isSafeInteger(expected.prNumber) ||
    expected.prNumber <= 0 ||
    !SHA_PATTERN.test(expected.headSha) ||
    !expected.repository
  ) {
    throw new Error("workflow_runの期待値が不正です");
  }

  const decision = await readJson(join(directory, "decision.json"), "decision.json");
  const manifest = await readJson(join(directory, "manifest.json"), "manifest.json");
  assertDecision(decision, expected);
  assertManifestShape(manifest, decision, expected);

  const allowedFiles = new Set(["decision.json", "manifest.json"]);
  for (const media of manifest.media) {
    if (!VIEWPORTS.has(media.viewport) || !manifest.viewports.includes(media.viewport)) {
      throw new Error("manifestに未対応viewportのmediaがあります");
    }
    if (
      !Number.isFinite(media.durationSeconds) ||
      media.durationSeconds < MIN_DURATION_SECONDS ||
      media.durationSeconds > MAX_DURATION_SECONDS
    ) {
      throw new Error(`${media.viewport}の動画時間は15〜45秒にしてください`);
    }
    allowedFiles.add(`${media.viewport}.gif`);
    allowedFiles.add(`${media.viewport}.mp4`);
    await validateMediaFile(
      directory,
      media.gif,
      "gif",
      media.viewport,
      media.durationSeconds,
    );
    await validateMediaFile(
      directory,
      media.mp4,
      "mp4",
      media.viewport,
      media.durationSeconds,
    );
  }
  await assertOnlyAllowedFiles(directory, allowedFiles);

  return { decision, manifest };
}

export function buildDemoComment(manifest, pagesBaseUrl) {
  const base = pagesBaseUrl.replace(/\/+$/, "");
  const assetBase = `${base}/pr/${manifest.prNumber}/${manifest.headSha}`;
  const sections = manifest.media.map(
    (media) => `### ${media.viewport}

![${media.viewport} 動作ビデオ](${assetBase}/${media.gif.file})

[MP4を開く](${assetBase}/${media.mp4.file})（${media.durationSeconds.toFixed(1)}秒）`,
  );

  return `${COMMENT_MARKER}
## 🎬 動作ビデオ

${sections.join("\n\n")}

- シナリオ: \`${manifest.spec}\` / \`${manifest.tag}\`
- 録画環境: CIローカル環境（合成E2Eデータ）
- Recorded HEAD: \`${manifest.headSha}\`

この動画は通常のレビュー用です。OAuth・外部連携・本番固有変更はPreviewでも確認してください。`;
}

export function buildExpiredComment({ headSha }) {
  return `${COMMENT_MARKER}
## 🎬 動作ビデオ

保存期間（${RETENTION_DAYS}日）が終了したため、動画fileを削除しました。

- Recorded HEAD: \`${headSha}\``;
}

export function buildSkippedComment({ headSha, reason }) {
  const safeReason = String(reason ?? "ユーザー表示に影響する変更がありません")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 300)
    .replace(/[\\[\]()`*_<>]/g, "\\$&");
  return `${COMMENT_MARKER}
## 🎬 動作ビデオ

最新HEADは動作ビデオの対象外です。以前の動画fileは削除しました。

- 理由: ${safeReason}
- Recorded HEAD: \`${headSha}\``;
}

export function buildFailureComment({ headSha, reason, runUrl }) {
  const safeReason = String(reason ?? "不明なエラー")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 300)
    .replace(/[\\[\]()`*_<>]/g, "\\$&");
  const safeRunUrl = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+(?:\/.*)?$/.test(
    runUrl,
  )
    ? runUrl
    : null;

  return `${COMMENT_MARKER}
## 🎬 動作ビデオを公開できませんでした

- 理由: ${safeReason}
- Recorded HEAD: \`${headSha}\`${safeRunUrl ? `\n- [Actions run](${safeRunUrl})` : ""}

\`demo-video\` が成功するまでこのPRはReady扱いにできません。`;
}

export function shouldExpireDemo({ state, closedAt, now, retentionDays }) {
  if (state !== "closed" || !closedAt) {
    return false;
  }
  const closedTime = Date.parse(closedAt);
  if (Number.isNaN(closedTime)) {
    return false;
  }
  const threshold = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return closedTime <= threshold;
}
