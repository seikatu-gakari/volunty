import { createHash } from "node:crypto";
import {
  cp,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const VIEWPORTS = new Set(["desktop", "mobile"]);
const MAX_GIF_BYTES = 8 * 1024 * 1024;
const MAX_MP4_BYTES = 12 * 1024 * 1024;
const MAX_SITE_BYTES = 900 * 1024 * 1024;
const MAX_PENDING_CLEANUPS = 2000;
const MAX_MANUAL_FORK_APPROVALS = 2000;
export const CLEANUP_PENDING_FILE = ".pr-demo-cleanup-pending.json";
export const MANUAL_FORK_APPROVALS_FILE = ".pr-demo-manual-fork-approvals.json";

function assertPrNumber(prNumber) {
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new Error("PR番号が不正です");
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function normalizePendingCleanup(pending) {
  if (
    !Array.isArray(pending) ||
    pending.length > MAX_PENDING_CLEANUPS ||
    pending.some(
      (entry) =>
        !Number.isSafeInteger(entry?.prNumber) ||
        entry.prNumber <= 0 ||
        !SHA_PATTERN.test(entry.headSha ?? ""),
    ) ||
    new Set(pending.map((entry) => entry.prNumber)).size !== pending.length
  ) {
    throw new Error("cleanup再試行stateが不正です");
  }
  return pending
    .map(({ prNumber, headSha }) => ({ prNumber, headSha }))
    .sort((left, right) => left.prNumber - right.prNumber);
}

export async function readPendingCleanup(siteDirectory) {
  const path = join(siteDirectory, CLEANUP_PENDING_FILE);
  if (!(await pathExists(path))) {
    return [];
  }
  const metadata = await lstat(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > 1024 * 1024
  ) {
    throw new Error("cleanup再試行stateは許可size内の通常fileである必要があります");
  }
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`cleanup再試行stateをJSONとして読めません: ${error.message}`);
  }
  if (document?.schemaVersion !== 1) {
    throw new Error("cleanup再試行stateのschemaが不正です");
  }
  return normalizePendingCleanup(document.pending);
}

export async function writePendingCleanup(siteDirectory, pending) {
  const normalized = normalizePendingCleanup(pending);
  const path = join(siteDirectory, CLEANUP_PENDING_FILE);
  if (normalized.length === 0) {
    await rm(path, { force: true });
    return normalized;
  }
  await writeFile(
    path,
    `${JSON.stringify({ schemaVersion: 1, pending: normalized }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return normalized;
}

export async function clearPendingCleanupForPr(siteDirectory, prNumber) {
  assertPrNumber(prNumber);
  const pending = await readPendingCleanup(siteDirectory);
  const remaining = pending.filter((entry) => entry.prNumber !== prNumber);
  if (remaining.length === pending.length) {
    return false;
  }
  await writePendingCleanup(siteDirectory, remaining);
  return true;
}

function normalizeManualForkApprovals(approvals) {
  if (
    !Array.isArray(approvals) ||
    approvals.length > MAX_MANUAL_FORK_APPROVALS ||
    approvals.some(
      (entry) =>
        !Number.isSafeInteger(entry?.prNumber) ||
        entry.prNumber <= 0 ||
        !SHA_PATTERN.test(entry.headSha ?? "") ||
        !Number.isSafeInteger(entry.runId) ||
        entry.runId <= 0 ||
        !Number.isSafeInteger(entry.runAttempt) ||
        entry.runAttempt <= 0,
    ) ||
    new Set(approvals.map((entry) => entry.prNumber)).size !== approvals.length
  ) {
    throw new Error("fork手動承認stateが不正です");
  }
  return approvals
    .map(({ prNumber, headSha, runId, runAttempt }) => ({
      prNumber,
      headSha,
      runId,
      runAttempt,
    }))
    .sort((left, right) => left.prNumber - right.prNumber);
}

export function validateManualForkApprovalsDocument(document) {
  if (document?.schemaVersion !== 1) {
    throw new Error("fork手動承認stateのschemaが不正です");
  }
  return normalizeManualForkApprovals(document.approvals);
}

export function matchesManualForkApproval(approvals, identity) {
  const normalized = normalizeManualForkApprovals(approvals);
  const [expected] = normalizeManualForkApprovals([identity]);
  return normalized.some(
    (approval) =>
      approval.prNumber === expected.prNumber &&
      approval.headSha === expected.headSha &&
      approval.runId === expected.runId &&
      approval.runAttempt === expected.runAttempt,
  );
}

export async function readManualForkApprovals(siteDirectory) {
  const path = join(siteDirectory, MANUAL_FORK_APPROVALS_FILE);
  if (!(await pathExists(path))) {
    return [];
  }
  const metadata = await lstat(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > 1024 * 1024
  ) {
    throw new Error("fork手動承認stateは許可size内の通常fileである必要があります");
  }
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`fork手動承認stateをJSONとして読めません: ${error.message}`);
  }
  return validateManualForkApprovalsDocument(document);
}

export async function writeManualForkApprovals(siteDirectory, approvals) {
  const normalized = normalizeManualForkApprovals(approvals);
  const path = join(siteDirectory, MANUAL_FORK_APPROVALS_FILE);
  if (normalized.length === 0) {
    await rm(path, { force: true });
    return normalized;
  }
  await writeFile(
    path,
    `${JSON.stringify({ schemaVersion: 1, approvals: normalized }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return normalized;
}

export async function hasManualForkApproval(siteDirectory, identity) {
  const approvals = await readManualForkApprovals(siteDirectory);
  return matchesManualForkApproval(approvals, identity);
}

export async function recordManualForkApproval(siteDirectory, identity) {
  const [approval] = normalizeManualForkApprovals([identity]);
  const current = await readManualForkApprovals(siteDirectory);
  const next = normalizeManualForkApprovals([
    ...current.filter((entry) => entry.prNumber !== approval.prNumber),
    approval,
  ]);
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return false;
  }
  await writeManualForkApprovals(siteDirectory, next);
  return true;
}

export async function clearManualForkApprovalForPr(siteDirectory, prNumber) {
  assertPrNumber(prNumber);
  const approvals = await readManualForkApprovals(siteDirectory);
  const remaining = approvals.filter((entry) => entry.prNumber !== prNumber);
  if (remaining.length === approvals.length) {
    return false;
  }
  await writeManualForkApprovals(siteDirectory, remaining);
  return true;
}

function renderIndex(demos) {
  const items = demos
    .sort((left, right) => right.prNumber - left.prNumber)
    .map((demo) => {
      const base = `pr/${demo.prNumber}/${demo.headSha}`;
      return `<li><strong>PR #${demo.prNumber}</strong> <code>${demo.headSha.slice(0, 7)}</code> — <a href="${base}/${demo.media[0].mp4.file}">MP4</a></li>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Volunty PR Demos</title></head>
<body><main><h1>Volunty PR Demos</h1><ul>${items}</ul></main></body>
</html>
`;
}

async function refreshIndex(siteDirectory) {
  await mkdir(siteDirectory, { recursive: true });
  await writeFile(join(siteDirectory, ".nojekyll"), "");
  await writeFile(join(siteDirectory, "index.html"), renderIndex(await listPublishedDemos(siteDirectory)));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function assertRegularFile(path, label, maxBytes) {
  const metadata = await lstat(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > maxBytes
  ) {
    throw new Error(`${label}は許可size内の通常fileである必要があります`);
  }
  return metadata;
}

async function validatePublishedMedia(directory, media, kind) {
  const file = `${media.viewport}.${kind}`;
  const descriptor = media[kind];
  const maxBytes = kind === "gif" ? MAX_GIF_BYTES : MAX_MP4_BYTES;
  if (
    descriptor?.file !== file ||
    !Number.isSafeInteger(descriptor.bytes) ||
    descriptor.bytes <= 0 ||
    !/^[0-9a-f]{64}$/.test(descriptor.sha256 ?? "")
  ) {
    throw new Error(`${file}のdescriptorが不正です`);
  }
  const metadata = await assertRegularFile(join(directory, file), file, maxBytes);
  if (metadata.size !== descriptor.bytes) {
    throw new Error(`${file}のsizeがmanifestと一致しません`);
  }
  const buffer = await readFile(join(directory, file));
  const validMagic =
    kind === "gif"
      ? ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))
      : buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (!validMagic) {
    throw new Error(`${file}のfile形式が不正です`);
  }
  if (sha256(buffer) !== descriptor.sha256) {
    throw new Error(`${file}のSHA-256がmanifestと一致しません`);
  }
}

async function validatePublishedDemo(directory, prNumber, headSha) {
  const manifestPath = join(directory, "manifest.json");
  await assertRegularFile(manifestPath, "manifest.json", 1024 * 1024);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest.schemaVersion !== 1 ||
    manifest.prNumber !== prNumber ||
    manifest.headSha !== headSha ||
    manifest.environment !== "ci-local" ||
    !REPOSITORY_PATTERN.test(manifest.repository ?? "") ||
    Number.isNaN(Date.parse(manifest.generatedAt)) ||
    !/^e2e\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(manifest.spec ?? "") ||
    !/^@demo-[1-9][0-9]*$/.test(manifest.tag ?? "") ||
    !Array.isArray(manifest.viewports) ||
    manifest.viewports.length === 0 ||
    manifest.viewports.some((viewport) => !VIEWPORTS.has(viewport)) ||
    new Set(manifest.viewports).size !== manifest.viewports.length ||
    !Array.isArray(manifest.media) ||
    manifest.media.length !== manifest.viewports.length
  ) {
    throw new Error(`PR #${prNumber}の公開manifestが不正です`);
  }

  const allowedFiles = new Set(["manifest.json"]);
  const mediaViewports = new Set();
  for (const media of manifest.media) {
    if (
      !manifest.viewports.includes(media.viewport) ||
      mediaViewports.has(media.viewport) ||
      typeof media.durationSeconds !== "number" ||
      media.durationSeconds < 15 ||
      media.durationSeconds > 45
    ) {
      throw new Error(`PR #${prNumber}の公開mediaが不正です`);
    }
    mediaViewports.add(media.viewport);
    allowedFiles.add(`${media.viewport}.gif`);
    allowedFiles.add(`${media.viewport}.mp4`);
    await validatePublishedMedia(directory, media, "gif");
    await validatePublishedMedia(directory, media, "mp4");
  }

  const entries = await readdir(directory, { withFileTypes: true });
  if (
    entries.length !== allowedFiles.size ||
    entries.some(
      (entry) =>
        !allowedFiles.has(entry.name) ||
        !entry.isFile() ||
        entry.isSymbolicLink(),
    )
  ) {
    throw new Error(`PR #${prNumber}の公開directoryに未許可entryがあります`);
  }
  return manifest;
}

async function scanPublishedDemos(siteDirectory) {
  const root = join(siteDirectory, "pr");
  if (!(await pathExists(root))) {
    return [];
  }

  const rootMetadata = await lstat(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Pagesのpr entryは通常directoryである必要があります");
  }

  const demos = [];
  for (const prEntry of await readdir(root, { withFileTypes: true })) {
    if (!prEntry.isDirectory() || !/^[1-9][0-9]*$/.test(prEntry.name)) {
      throw new Error(`Pagesのpr directoryに未許可entryがあります: ${prEntry.name}`);
    }
    const prNumber = Number.parseInt(prEntry.name, 10);
    const prDirectory = join(root, prEntry.name);
    const shaEntries = await readdir(prDirectory, { withFileTypes: true });
    if (
      shaEntries.length !== 1 ||
      !shaEntries[0].isDirectory() ||
      !SHA_PATTERN.test(shaEntries[0].name)
    ) {
      throw new Error(`PR #${prNumber}には最新HEAD directoryが正確に1件必要です`);
    }
    demos.push(
      await validatePublishedDemo(
        join(prDirectory, shaEntries[0].name),
        prNumber,
        shaEntries[0].name,
      ),
    );
  }
  return demos;
}

export async function listPublishedDemos(siteDirectory) {
  return scanPublishedDemos(siteDirectory);
}

export function assertSiteCapacity(demos) {
  const totalBytes = demos.reduce(
    (total, demo) =>
      total +
      demo.media.reduce(
        (mediaTotal, media) => mediaTotal + media.gif.bytes + media.mp4.bytes,
        0,
      ),
    0,
  );
  if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_SITE_BYTES) {
    throw new Error("Pages公開量が安全margin 900MiBを超えています");
  }
  return totalBytes;
}

export async function validateSiteDirectory(siteDirectory) {
  const entries = await readdir(siteDirectory, { withFileTypes: true });
  const allowedEntries = new Set([
    ".git",
    ".nojekyll",
    CLEANUP_PENDING_FILE,
    MANUAL_FORK_APPROVALS_FILE,
    "index.html",
    "pr",
  ]);
  for (const entry of entries) {
    if (!allowedEntries.has(entry.name) || entry.isSymbolicLink()) {
      throw new Error(`Pages rootに未許可entryまたはsymlinkがあります: ${entry.name}`);
    }
    if (entry.name === ".git" || entry.name === "pr") {
      if (!entry.isDirectory()) {
        throw new Error(`${entry.name}は通常directoryである必要があります`);
      }
    } else if (!entry.isFile()) {
      throw new Error(`${entry.name}は通常fileである必要があります`);
    }
  }

  const demos = await scanPublishedDemos(siteDirectory);
  await readPendingCleanup(siteDirectory);
  await readManualForkApprovals(siteDirectory);
  assertSiteCapacity(demos);
  if (await pathExists(join(siteDirectory, ".nojekyll"))) {
    if ((await readFile(join(siteDirectory, ".nojekyll"))).length !== 0) {
      throw new Error(".nojekyllは空fileである必要があります");
    }
  }
  if (await pathExists(join(siteDirectory, "index.html"))) {
    await assertRegularFile(join(siteDirectory, "index.html"), "index.html", 1024 * 1024);
    const actualIndex = await readFile(join(siteDirectory, "index.html"), "utf8");
    if (actualIndex !== renderIndex(demos)) {
      throw new Error("index.htmlが公開manifest一覧と一致しません");
    }
  }
  return demos;
}

function isSameOrDescendant(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

export async function preparePublicSiteDirectory({
  siteDirectory,
  publicDirectory,
}) {
  const source = resolve(siteDirectory);
  const destination = resolve(publicDirectory);
  if (
    isSameOrDescendant(source, destination) ||
    isSameOrDescendant(destination, source)
  ) {
    throw new Error("公開用Pages treeは永続化treeと分離したdirectoryが必要です");
  }

  await validateSiteDirectory(source);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const entry of [".nojekyll", "index.html", "pr"]) {
    const sourcePath = join(source, entry);
    if (!(await pathExists(sourcePath))) {
      continue;
    }
    await cp(sourcePath, join(destination, entry), {
      recursive: entry === "pr",
      force: false,
      errorOnExist: true,
    });
  }
  const demos = await validateSiteDirectory(destination);
  if (await pathExists(join(destination, CLEANUP_PENDING_FILE))) {
    throw new Error("公開用Pages treeにcleanup再試行stateを含められません");
  }
  if (await pathExists(join(destination, MANUAL_FORK_APPROVALS_FILE))) {
    throw new Error("公開用Pages treeにfork手動承認stateを含められません");
  }
  return demos;
}

export async function installDemoOnSite({ artifactDirectory, siteDirectory, manifest }) {
  assertPrNumber(manifest.prNumber);
  if (!SHA_PATTERN.test(manifest.headSha)) {
    throw new Error("HEAD SHAが不正です");
  }

  const prDirectory = join(siteDirectory, "pr", String(manifest.prNumber));
  await rm(prDirectory, { recursive: true, force: true });
  const destination = join(prDirectory, manifest.headSha);
  await mkdir(destination, { recursive: true });

  await writeFile(
    join(destination, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  for (const media of manifest.media) {
    await copyFile(join(artifactDirectory, media.gif.file), join(destination, media.gif.file));
    await copyFile(join(artifactDirectory, media.mp4.file), join(destination, media.mp4.file));
  }
  await clearPendingCleanupForPr(siteDirectory, manifest.prNumber);
  await clearManualForkApprovalForPr(siteDirectory, manifest.prNumber);
  await refreshIndex(siteDirectory);
  return destination;
}

export async function removeDemoFromSite(siteDirectory, prNumber) {
  assertPrNumber(prNumber);
  const prDirectory = join(siteDirectory, "pr", String(prNumber));
  if (!(await pathExists(prDirectory))) {
    return false;
  }
  await rm(prDirectory, { recursive: true });
  await refreshIndex(siteDirectory);
  return true;
}
