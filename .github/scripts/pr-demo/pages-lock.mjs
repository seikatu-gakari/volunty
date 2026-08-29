#!/usr/bin/env node

import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = "https://api.github.com";
const LOCK_REF = "refs/heads/pr-demo-pages-lock";
const LOCK_REF_PATH = "heads/pr-demo-pages-lock";
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DEFAULT_MAX_WAIT_MS = 75 * 60 * 1000;
const DEFAULT_POLL_MS = 5000;
const STALE_GRACE_MS = 60 * 1000;

function validateIdentity(identity) {
  if (
    !REPOSITORY_PATTERN.test(identity?.repository ?? "") ||
    !Number.isSafeInteger(identity?.runId) ||
    identity.runId <= 0 ||
    !Number.isSafeInteger(identity?.runAttempt) ||
    identity.runAttempt <= 0
  ) {
    throw new Error("Pages lockのworkflow identityが不正です");
  }
  return identity;
}

export function formatLockMessage(identity, acquiredAt) {
  validateIdentity(identity);
  if (!(acquiredAt instanceof Date) || Number.isNaN(acquiredAt.getTime())) {
    throw new Error("Pages lockの取得日時が不正です");
  }
  return [
    "pr-demo-pages-lock:v1",
    `repository:${identity.repository}`,
    `run-id:${identity.runId}`,
    `run-attempt:${identity.runAttempt}`,
    `acquired-at:${acquiredAt.toISOString()}`,
  ].join("\n");
}

export function parseLockMessage(message) {
  const match = /^pr-demo-pages-lock:v1\nrepository:([^\n]+)\nrun-id:([1-9][0-9]*)\nrun-attempt:([1-9][0-9]*)\nacquired-at:([^\n]+)$/.exec(
    message ?? "",
  );
  if (!match) {
    throw new Error("Pages lock commitのmetadataが不正です");
  }
  const identity = validateIdentity({
    repository: match[1],
    runId: Number.parseInt(match[2], 10),
    runAttempt: Number.parseInt(match[3], 10),
  });
  const acquiredAt = new Date(match[4]);
  if (Number.isNaN(acquiredAt.getTime()) || acquiredAt.toISOString() !== match[4]) {
    throw new Error("Pages lock commitの取得日時が不正です");
  }
  return { ...identity, acquiredAt };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`GitHub APIがJSON以外を返しました: ${response.status}`);
  }
}

export function createPagesLockClient({ token, repository, fetchImpl = fetch }) {
  if (!token || !REPOSITORY_PATTERN.test(repository ?? "")) {
    throw new Error("Pages lockのGitHub設定が不正です");
  }
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function request(path, { method = "GET", body } = {}) {
    const response = await fetchImpl(`${API_ROOT}/repos/${repository}${path}`, {
      method,
      headers: {
        ...headers,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await readJsonResponse(response);
    return { response, payload };
  }

  async function getLock() {
    const refResponse = await request(`/git/ref/${LOCK_REF_PATH}`);
    if (refResponse.response.status === 404) {
      return undefined;
    }
    if (refResponse.response.status !== 200) {
      throw new Error(`Pages lock ref取得に失敗しました: ${refResponse.response.status}`);
    }
    const ref = refResponse.payload;
    if (
      ref?.ref !== LOCK_REF ||
      typeof ref.node_id !== "string" ||
      ref.node_id.length === 0 ||
      ref.object?.type !== "commit" ||
      !SHA_PATTERN.test(ref.object.sha ?? "")
    ) {
      throw new Error("Pages lock refのresponseが不正です");
    }
    const commitResponse = await request(`/git/commits/${ref.object.sha}`);
    if (
      commitResponse.response.status !== 200 ||
      commitResponse.payload?.sha !== ref.object.sha ||
      typeof commitResponse.payload?.message !== "string"
    ) {
      throw new Error("Pages lock commitを確認できません");
    }
    return {
      refId: ref.node_id,
      sha: ref.object.sha,
      ...parseLockMessage(commitResponse.payload.message),
    };
  }

  async function createLock(identity, acquiredAt) {
    const mainRefResponse = await request("/git/ref/heads/main");
    const mainSha = mainRefResponse.payload?.object?.sha;
    if (mainRefResponse.response.status !== 200 || !SHA_PATTERN.test(mainSha ?? "")) {
      throw new Error("main refをPages lockの親として確認できません");
    }
    const mainCommitResponse = await request(`/git/commits/${mainSha}`);
    const treeSha = mainCommitResponse.payload?.tree?.sha;
    if (
      mainCommitResponse.response.status !== 200 ||
      mainCommitResponse.payload?.sha !== mainSha ||
      !SHA_PATTERN.test(treeSha ?? "")
    ) {
      throw new Error("main commit treeをPages lock用に確認できません");
    }
    const commitResponse = await request("/git/commits", {
      method: "POST",
      body: {
        message: formatLockMessage(identity, acquiredAt),
        tree: treeSha,
        parents: [mainSha],
      },
    });
    const lockSha = commitResponse.payload?.sha;
    if (commitResponse.response.status !== 201 || !SHA_PATTERN.test(lockSha ?? "")) {
      throw new Error("Pages lock commitを作成できません");
    }
    const createRefResponse = await request("/git/refs", {
      method: "POST",
      body: { ref: LOCK_REF, sha: lockSha },
    });
    if (createRefResponse.response.status === 422) {
      return undefined;
    }
    const ref = createRefResponse.payload;
    if (
      createRefResponse.response.status !== 201 ||
      ref?.ref !== LOCK_REF ||
      typeof ref.node_id !== "string" ||
      ref.node_id.length === 0 ||
      ref.object?.sha !== lockSha
    ) {
      throw new Error("Pages lock refを作成できません");
    }
    return {
      refId: ref.node_id,
      sha: lockSha,
      ...identity,
      acquiredAt,
    };
  }

  async function getWorkflowRun(runId) {
    const runResponse = await request(`/actions/runs/${runId}`);
    if (runResponse.response.status === 404) {
      return undefined;
    }
    const run = runResponse.payload;
    if (
      runResponse.response.status !== 200 ||
      run?.id !== runId ||
      !Number.isSafeInteger(run.run_attempt) ||
      run.run_attempt <= 0 ||
      run.repository?.full_name !== repository ||
      typeof run.status !== "string"
    ) {
      throw new Error("Pages lock所有workflow runを確認できません");
    }
    return run;
  }

  async function deleteLock(refId) {
    if (typeof refId !== "string" || refId.length === 0) {
      throw new Error("削除対象Pages lock ref IDが不正です");
    }
    const response = await fetchImpl(`${API_ROOT}/graphql`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "mutation($refId:ID!){deleteRef(input:{refId:$refId}){clientMutationId}}",
        variables: { refId },
      }),
    });
    const payload = await readJsonResponse(response);
    if (
      response.status === 200 &&
      Array.isArray(payload?.errors) &&
      payload.errors.length > 0 &&
      payload.errors.every((error) => error?.type === "NOT_FOUND")
    ) {
      return "absent";
    }
    if (response.status !== 200 || payload?.errors || !payload?.data?.deleteRef) {
      throw new Error(`Pages lock ref削除に失敗しました: ${response.status}`);
    }
    return "deleted";
  }

  return { getLock, createLock, getWorkflowRun, deleteLock };
}

function sameOwner(lock, identity) {
  return (
    lock.repository === identity.repository &&
    lock.runId === identity.runId &&
    lock.runAttempt === identity.runAttempt
  );
}

export async function acquirePagesLock({
  identity,
  client,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
  pollMs = DEFAULT_POLL_MS,
  now = () => new Date(),
  sleep = (milliseconds) =>
    new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
}) {
  validateIdentity(identity);
  if (
    !Number.isSafeInteger(maxWaitMs) ||
    maxWaitMs <= 0 ||
    maxWaitMs > DEFAULT_MAX_WAIT_MS ||
    !Number.isSafeInteger(pollMs) ||
    pollMs <= 0 ||
    pollMs > 60_000
  ) {
    throw new Error("Pages lockの待機設定が不正です");
  }
  const startedAt = now();
  if (!(startedAt instanceof Date) || Number.isNaN(startedAt.getTime())) {
    throw new Error("Pages lockの現在時刻が不正です");
  }

  while (now().getTime() - startedAt.getTime() <= maxWaitMs) {
    const existing = await client.getLock();
    if (existing && sameOwner(existing, identity)) {
      return existing;
    }
    if (existing) {
      const ageMs = now().getTime() - existing.acquiredAt.getTime();
      if (ageMs >= STALE_GRACE_MS) {
        const ownerRun = await client.getWorkflowRun(existing.runId);
        if (
          !ownerRun ||
          ownerRun.status === "completed" ||
          ownerRun.run_attempt !== existing.runAttempt
        ) {
          await client.deleteLock(existing.refId);
          continue;
        }
      }
      await sleep(pollMs);
      continue;
    }

    const acquiredAt = now();
    const created = await client.createLock(identity, acquiredAt);
    if (created) {
      return created;
    }
    await sleep(pollMs);
  }
  throw new Error("GitHub Pages publish lockの取得がtimeoutしました");
}

export async function releasePagesLock({ identity, expectedRefId, expectedSha, client }) {
  validateIdentity(identity);
  if (
    typeof expectedRefId !== "string" ||
    expectedRefId.length === 0 ||
    !SHA_PATTERN.test(expectedSha ?? "")
  ) {
    throw new Error("Pages lock解放identityが不正です");
  }
  const existing = await client.getLock();
  if (!existing) {
    return "absent";
  }
  if (
    !sameOwner(existing, identity) ||
    existing.refId !== expectedRefId ||
    existing.sha !== expectedSha
  ) {
    throw new Error("別workflowが所有するPages lockは解放できません");
  }
  await client.deleteLock(existing.refId);
  return "released";
}

async function writeOutputs(path, lock) {
  if (!path) {
    return;
  }
  await appendFile(path, `lock_ref_id=${lock.refId}\nlock_sha=${lock.sha}\n`);
}

export async function main({
  action = process.argv[2],
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  runIdValue = process.env.GITHUB_RUN_ID,
  runAttemptValue = process.env.GITHUB_RUN_ATTEMPT,
  outputPath = process.env.GITHUB_OUTPUT,
  expectedRefId = process.env.PR_DEMO_PAGES_LOCK_REF_ID,
  expectedSha = process.env.PR_DEMO_PAGES_LOCK_SHA,
  client,
} = {}) {
  if (!/^[1-9][0-9]*$/.test(runIdValue ?? "") || !/^[1-9][0-9]*$/.test(runAttemptValue ?? "")) {
    throw new Error("Pages lockのGitHub run identityが不正です");
  }
  const identity = validateIdentity({
    repository,
    runId: Number.parseInt(runIdValue, 10),
    runAttempt: Number.parseInt(runAttemptValue, 10),
  });
  const pagesLockClient =
    client ?? createPagesLockClient({ token, repository: identity.repository });
  if (action === "acquire") {
    const lock = await acquirePagesLock({ identity, client: pagesLockClient });
    await writeOutputs(outputPath, lock);
    console.log(`[pr-demo] Pages lock acquired run=${identity.runId}`);
    return lock;
  }
  if (action === "release") {
    const outcome = await releasePagesLock({
      identity,
      expectedRefId,
      expectedSha,
      client: pagesLockClient,
    });
    console.log(`[pr-demo] Pages lock ${outcome} run=${identity.runId}`);
    return outcome;
  }
  throw new Error("Pages lock actionはacquire/releaseだけを許可します");
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
