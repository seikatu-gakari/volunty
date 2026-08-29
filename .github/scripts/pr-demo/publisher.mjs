import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { buildDemoComment, validateArtifactDirectory } from "./artifact.mjs";
import {
  clearPendingCleanupForPr,
  installDemoOnSite,
  removeDemoFromSite,
  validateSiteDirectory,
} from "./site.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const EXPECTED_WORKFLOW_NAME = "Pull Request CI";

function safeReason(reason, fallback) {
  const normalized = String(reason ?? fallback)
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 300);
  return normalized || fallback;
}

function assertRunUrl(runUrl, repository, runId) {
  const expected = `https://github.com/${repository}/actions/runs/${runId}`;
  if (runUrl !== expected && !runUrl.startsWith(`${expected}/`)) {
    throw new Error("workflow_run URLが不正です");
  }
}

export function extractWorkflowRunContext(event) {
  const run = event?.workflow_run;
  const repository = event?.repository?.full_name;
  if (
    !run ||
    run.name !== EXPECTED_WORKFLOW_NAME ||
    run.event !== "pull_request" ||
    !Number.isSafeInteger(run.id) ||
    run.id <= 0 ||
    !REPOSITORY_PATTERN.test(repository ?? "") ||
    !SHA_PATTERN.test(run.head_sha ?? "")
  ) {
    throw new Error("trustedなPull Request CI workflow_runではありません");
  }

  const pullRequests = run.pull_requests ?? [];
  if (pullRequests.length !== 1) {
    throw new Error("workflow_runにPRが正確に1件必要です");
  }
  const pullRequest = pullRequests[0];
  if (!Number.isSafeInteger(pullRequest.number) || pullRequest.number <= 0) {
    throw new Error("workflow_runのPR番号が不正です");
  }
  if (pullRequest.head?.sha && pullRequest.head.sha !== run.head_sha) {
    throw new Error("workflow_runとPRのHEAD SHAが一致しません");
  }
  if (pullRequest.base?.sha && !SHA_PATTERN.test(pullRequest.base.sha)) {
    throw new Error("workflow_runのbase SHAが不正です");
  }

  const headRepository = run.head_repository?.full_name;
  if (!REPOSITORY_PATTERN.test(headRepository ?? "")) {
    throw new Error("workflow_runのhead repositoryが不正です");
  }
  assertRunUrl(run.html_url, repository, run.id);

  return {
    prNumber: pullRequest.number,
    headSha: run.head_sha,
    repository,
    headRepository,
    sameRepository: headRepository === repository,
    conclusion: run.conclusion,
    runId: run.id,
    runUrl: run.html_url,
  };
}

async function readDecision(directory) {
  const path = join(directory, "decision.json");
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 1024 * 1024) {
    throw new Error("decision.jsonが通常fileではないか大きすぎます");
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`decision.jsonを読めません: ${error.message}`);
  }
}

function validateDecisionIdentity(decision, context) {
  if (
    decision?.schemaVersion !== 1 ||
    !["capture", "skip", "error"].includes(decision.outcome) ||
    decision.prNumber !== context.prNumber ||
    decision.headSha !== context.headSha ||
    decision.baseRepository !== context.repository ||
    decision.headRepository !== context.headRepository ||
    !SHA_PATTERN.test(decision.baseSha ?? "") ||
    Number.isNaN(Date.parse(decision.evaluatedAt))
  ) {
    throw new Error("decision.jsonのidentityまたはschemaがworkflow_runと一致しません");
  }
  if (
    !Array.isArray(decision.changedFiles) ||
    decision.changedFiles.length > 2000 ||
    decision.changedFiles.some(
      (path) =>
        typeof path !== "string" ||
        path.length === 0 ||
        path.length > 500 ||
        /[\r\n\0]/.test(path),
    )
  ) {
    throw new Error("decision.jsonのchangedFilesが不正です");
  }
  if (typeof decision.reason !== "string" || decision.reason.length > 500) {
    throw new Error("decision.jsonのreasonが不正です");
  }
  if (decision.outcome === "skip" && decision.required !== false) {
    throw new Error("skip decisionのrequiredが不正です");
  }
  if (decision.outcome !== "skip" && decision.required !== true) {
    throw new Error("capture/error decisionのrequiredが不正です");
  }
  return decision;
}

function assertTrustedDecision(decision, trustedDecision) {
  const keys = [
    "schemaVersion",
    "outcome",
    "required",
    "uiChange",
    "reason",
    "contract",
    "prNumber",
    "headSha",
    "baseRepository",
    "headRepository",
    "changedFiles",
  ];
  if (
    !trustedDecision ||
    keys.some(
      (key) => JSON.stringify(decision[key]) !== JSON.stringify(trustedDecision[key]),
    )
  ) {
    throw new Error("decision.jsonがmainで再評価したtrusted PR metadataと一致しません");
  }
}

function validatePagesBaseUrl(pagesBaseUrl, repository) {
  const [owner, name] = repository.split("/");
  const url = new URL(pagesBaseUrl);
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== `${owner.toLowerCase()}.github.io` ||
    url.pathname.replace(/\/+$/, "") !== `/${name}` ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("GitHub Pages base URLがrepositoryと一致しません");
  }
  return url.toString().replace(/\/+$/, "");
}

export function buildFailureResult(context, reason) {
  return {
    schemaVersion: 1,
    outcome: "failure",
    siteChanged: false,
    prNumber: context.prNumber,
    headSha: context.headSha,
    repository: context.repository,
    runId: context.runId,
    runUrl: context.runUrl,
    reason: safeReason(reason, "動作ビデオの公開に失敗しました"),
  };
}

export function buildStaleResult(context, reason) {
  return {
    schemaVersion: 1,
    outcome: "stale",
    siteChanged: false,
    prNumber: context.prNumber,
    headSha: context.headSha,
    repository: context.repository,
    runId: context.runId,
    runUrl: context.runUrl,
    reason: safeReason(reason, "このworkflow_runは最新ではありません"),
  };
}

export async function removePublishedDemoForResult({ result, siteDirectory }) {
  if (!["skip", "failure"].includes(result.outcome)) {
    return result;
  }

  try {
    await stat(siteDirectory);
    await validateSiteDirectory(siteDirectory);
    const demoRemoved = await removeDemoFromSite(siteDirectory, result.prNumber);
    const pendingCleared = await clearPendingCleanupForPr(
      siteDirectory,
      result.prNumber,
    );
    await validateSiteDirectory(siteDirectory);
    return { ...result, siteChanged: demoRemoved || pendingCleared };
  } catch (error) {
    const priorReason = result.outcome === "failure" ? `${result.reason}; ` : "";
    return buildFailureResult(
      result,
      `${priorReason}旧動画の削除に失敗しました: ${error.message}`,
    );
  }
}

export async function preparePublish({
  event,
  currentHeadSha,
  forkApproved = false,
  trustedDecision,
  artifactDirectory,
  siteDirectory,
  pagesBaseUrl,
}) {
  const context = extractWorkflowRunContext(event);
  const liveHeadSha = currentHeadSha ?? context.headSha;
  if (!SHA_PATTERN.test(liveHeadSha)) {
    throw new Error("PRのcurrent HEAD SHAが不正です");
  }
  if (liveHeadSha !== context.headSha) {
    return buildStaleResult(
      context,
      "このworkflow_runはPRの最新HEADではありません",
    );
  }
  if (!context.sameRepository && forkApproved !== true) {
    return buildFailureResult(
      context,
      "fork由来のPRは自動公開しません。maintainer確認後にPublish PR demo videoを対象CI run IDで手動実行してください",
    );
  }
  if (context.conclusion !== "success") {
    return buildFailureResult(
      context,
      `${EXPECTED_WORKFLOW_NAME}が${context.conclusion ?? "未完了"}でした`,
    );
  }

  const decision = validateDecisionIdentity(await readDecision(artifactDirectory), context);
  assertTrustedDecision(decision, trustedDecision);
  if (decision.outcome === "error") {
    return buildFailureResult(context, decision.reason);
  }
  if (decision.outcome === "skip") {
    return {
      schemaVersion: 1,
      outcome: "skip",
      siteChanged: false,
      prNumber: context.prNumber,
      headSha: context.headSha,
      repository: context.repository,
      runId: context.runId,
      runUrl: context.runUrl,
      reason: safeReason(decision.reason, "ユーザー表示に影響する変更がありません"),
    };
  }

  const { manifest } = await validateArtifactDirectory(artifactDirectory, {
    prNumber: context.prNumber,
    headSha: context.headSha,
    repository: context.repository,
    headRepository: context.headRepository,
  });
  const base = validatePagesBaseUrl(pagesBaseUrl, context.repository);
  await stat(siteDirectory);
  await validateSiteDirectory(siteDirectory);
  const destination = await installDemoOnSite({ artifactDirectory, siteDirectory, manifest });
  await validateSiteDirectory(siteDirectory);
  const publishedManifest = await readFile(join(destination, "manifest.json"));
  const manifestSha256 = createHash("sha256").update(publishedManifest).digest("hex");
  const assetBase = `${base}/pr/${context.prNumber}/${context.headSha}`;
  return {
    schemaVersion: 1,
    outcome: "published",
    siteChanged: true,
    prNumber: context.prNumber,
    headSha: context.headSha,
    repository: context.repository,
    runId: context.runId,
    runUrl: context.runUrl,
    reason: "動作ビデオを公開しました",
    manifestUrl: `${assetBase}/manifest.json`,
    manifestSha256,
    comment: buildDemoComment(manifest, base),
  };
}
