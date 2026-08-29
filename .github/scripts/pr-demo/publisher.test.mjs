import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  buildFailureResult,
  extractWorkflowRunContext,
  preparePublish,
  removePublishedDemoForResult,
} from "./publisher.mjs";
import { readPendingCleanup, writePendingCleanup } from "./site.mjs";
import { createTestMedia } from "./test-media-helper.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);
const baseSha = "a".repeat(40);
const testMedia = await createTestMedia();
after(testMedia.cleanup);

function createEvent(overrides = {}) {
  return {
    repository: { full_name: repository },
    workflow_run: {
      id: 987,
      run_attempt: 1,
      name: "Pull Request CI",
      event: "pull_request",
      conclusion: "success",
      head_sha: headSha,
      head_repository: { full_name: repository },
      html_url: `https://github.com/${repository}/actions/runs/987`,
      pull_requests: [
        {
          number: 321,
          head: { sha: headSha },
          base: { sha: baseSha },
        },
      ],
      ...overrides.workflow_run,
    },
    ...overrides.event,
  };
}

async function createDecisionArtifact({ outcome = "skip" } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-publisher-"));
  const decision = {
    schemaVersion: 1,
    outcome,
    required: outcome !== "skip",
    uiChange: outcome === "capture",
    reason:
      outcome === "skip"
        ? "ユーザー表示に影響する変更がありません"
        : "変更点を示す動作ビデオを生成します",
    contract:
      outcome === "capture"
        ? {
            version: 1,
            required: true,
            spec: "e2e/participant-discovery.spec.ts",
            tag: "@demo-221",
            viewports: ["desktop"],
            reason: "",
          }
        : {
            version: 1,
            required: false,
            spec: null,
            tag: null,
            viewports: [],
            reason: "ユーザー表示に影響する変更がありません",
          },
    prNumber: 321,
    baseSha,
    headSha,
    baseRepository: repository,
    headRepository: repository,
    changedFiles: ["docs/branch-workflow.md"],
    evaluatedAt: "2026-08-29T00:00:00.000Z",
  };
  await writeFile(join(directory, "decision.json"), `${JSON.stringify(decision)}\n`);
  return { directory, decision };
}

async function addCaptureMedia(directory, decision) {
  const gif = testMedia.gif;
  const mp4 = testMedia.mp4;
  const describe = (file, buffer) => ({
    file,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
  const manifest = {
    schemaVersion: 1,
    prNumber: 321,
    headSha,
    repository,
    environment: "ci-local",
    generatedAt: "2026-08-29T00:05:00.000Z",
    spec: decision.contract.spec,
    tag: decision.contract.tag,
    viewports: ["desktop"],
    media: [
      {
        viewport: "desktop",
        durationSeconds: testMedia.durationSeconds,
        gif: describe("desktop.gif", gif),
        mp4: describe("desktop.mp4", mp4),
      },
    ],
  };
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify(manifest)}\n`);
  await writeFile(join(directory, "desktop.gif"), gif);
  await writeFile(join(directory, "desktop.mp4"), mp4);
}

test("workflow_runからtrustedなPR identityを取り出す", () => {
  const context = extractWorkflowRunContext(createEvent());

  assert.equal(context.prNumber, 321);
  assert.equal(context.headSha, headSha);
  assert.equal(context.repository, repository);
  assert.equal(context.sameRepository, true);
});

test("workflow_run identityに再実行attempt番号を保持する", () => {
  const context = extractWorkflowRunContext(
    createEvent({ workflow_run: { run_attempt: 2 } }),
  );

  assert.equal(context.runId, 987);
  assert.equal(context.runAttempt, 2);
});

test("fork由来workflow_runはartifactを読む前に公開対象外と判定する", async () => {
  const event = createEvent({
    workflow_run: { head_repository: { full_name: "someone/volunty" } },
  });

  const result = await preparePublish({
    event,
    artifactDirectory: "/does/not/exist",
    siteDirectory: "/does/not/exist",
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  assert.equal(result.outcome, "failure");
  assert.match(result.reason, /fork/);
});

test("maintainer承認済みforkはidentity検証後に公開できる", async () => {
  const forkRepository = "someone/volunty";
  const { directory, decision } = await createDecisionArtifact({ outcome: "capture" });
  decision.headRepository = forkRepository;
  await writeFile(join(directory, "decision.json"), `${JSON.stringify(decision)}\n`);
  await addCaptureMedia(directory, decision);
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-fork-site-"));

  const result = await preparePublish({
    event: createEvent({
      workflow_run: { head_repository: { full_name: forkRepository } },
    }),
    forkApproved: true,
    trustedDecision: decision,
    artifactDirectory: directory,
    siteDirectory,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  assert.equal(result.outcome, "published");
});

test("古いworkflow_runは最新HEADのsite・comment・statusを上書きしない", async () => {
  const result = await preparePublish({
    event: createEvent(),
    currentHeadSha: "c".repeat(40),
    artifactDirectory: "/does/not/exist",
    siteDirectory: "/does/not/exist",
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  assert.equal(result.outcome, "stale");
  assert.equal(result.siteChanged, false);
});

test("成功した非UI PRは対象外success用resultになる", async () => {
  const { directory, decision } = await createDecisionArtifact();

  const result = await preparePublish({
    event: createEvent(),
    trustedDecision: decision,
    artifactDirectory: directory,
    siteDirectory: "/does/not/exist",
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  assert.equal(result.outcome, "skip");
  assert.equal(result.headSha, headSha);
  assert.equal(result.siteChanged, false);
});

test("対象外になった最新HEADでは同じPRの旧動画をPagesから除去する", async () => {
  const captureArtifact = await createDecisionArtifact({ outcome: "capture" });
  await addCaptureMedia(captureArtifact.directory, captureArtifact.decision);
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-skip-site-"));
  await preparePublish({
    event: createEvent(),
    trustedDecision: captureArtifact.decision,
    artifactDirectory: captureArtifact.directory,
    siteDirectory,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  const { directory, decision } = await createDecisionArtifact();
  const skipResult = await preparePublish({
    event: createEvent(),
    trustedDecision: decision,
    artifactDirectory: directory,
    siteDirectory,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });
  const result = await removePublishedDemoForResult({
    result: skipResult,
    siteDirectory,
  });

  assert.equal(result.outcome, "skip");
  assert.equal(result.siteChanged, true);
  await assert.rejects(
    readFile(join(siteDirectory, "pr", "321", headSha, "manifest.json")),
    /ENOENT/,
  );
});

test("対象外になった最新HEADでは同じPRのcleanup再試行stateも解除する", async () => {
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-skip-pending-"));
  await writePendingCleanup(siteDirectory, [{ prNumber: 321, headSha }]);
  const { directory, decision } = await createDecisionArtifact();
  const skipResult = await preparePublish({
    event: createEvent(),
    trustedDecision: decision,
    artifactDirectory: directory,
    siteDirectory,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  const result = await removePublishedDemoForResult({
    result: skipResult,
    siteDirectory,
  });

  assert.equal(result.outcome, "skip");
  assert.equal(result.siteChanged, true);
  assert.deepEqual(await readPendingCleanup(siteDirectory), []);
});

test("検証済みcapture artifactだけをSHA固有Pages pathへ配置する", async () => {
  const { directory, decision } = await createDecisionArtifact({ outcome: "capture" });
  await addCaptureMedia(directory, decision);
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-site-"));

  const result = await preparePublish({
    event: createEvent(),
    trustedDecision: decision,
    artifactDirectory: directory,
    siteDirectory,
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  assert.equal(result.outcome, "published");
  assert.equal(result.siteChanged, true);
  assert.match(result.manifestUrl, new RegExp(`pr/321/${headSha}/manifest\\.json$`));
  assert.match(result.manifestSha256, /^[0-9a-f]{64}$/);
  assert.match(result.comment, /CIローカル環境/);
  const published = JSON.parse(
    await readFile(join(siteDirectory, "pr", "321", headSha, "manifest.json"), "utf8"),
  );
  assert.equal(published.headSha, headSha);
});

test("PR側が偽装したskip decisionをtrusted PR metadataとの不一致で拒否する", async () => {
  const captureArtifact = await createDecisionArtifact({ outcome: "capture" });
  await addCaptureMedia(captureArtifact.directory, captureArtifact.decision);
  const trustedArtifact = await createDecisionArtifact({ outcome: "skip" });
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-forged-site-"));

  await assert.rejects(
    preparePublish({
      event: createEvent(),
      trustedDecision: trustedArtifact.decision,
      artifactDirectory: captureArtifact.directory,
      siteDirectory,
      pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    }),
    /trusted PR metadata/,
  );
});

test("既存Pages treeにsymlinkがあればartifact公開前に拒否する", async () => {
  const { directory, decision } = await createDecisionArtifact({ outcome: "capture" });
  await addCaptureMedia(directory, decision);
  const siteDirectory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-hostile-site-"));
  await symlink("/etc/passwd", join(siteDirectory, "unexpected-link"));

  await assert.rejects(
    preparePublish({
      event: createEvent(),
      trustedDecision: decision,
      artifactDirectory: directory,
      siteDirectory,
      pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
    }),
    /未許可entry|symlink/,
  );
});

test("CI失敗時はartifactがなくても最新HEADのfailure resultを返す", async () => {
  const event = createEvent({ workflow_run: { conclusion: "failure" } });

  const result = await preparePublish({
    event,
    artifactDirectory: "/does/not/exist",
    siteDirectory: "/does/not/exist",
    pagesBaseUrl: "https://seikatu-gakari.github.io/volunty",
  });

  assert.equal(result.outcome, "failure");
  assert.match(result.reason, /Pull Request CI/);
  assert.equal(result.headSha, headSha);
});

test("artifact検証例外をtrusted identity付きfailure resultへ変換できる", () => {
  const context = extractWorkflowRunContext(createEvent());
  const result = buildFailureResult(context, "manifestがありません");

  assert.equal(result.outcome, "failure");
  assert.equal(result.prNumber, 321);
  assert.equal(result.headSha, headSha);
  assert.match(result.reason, /manifest/);
});
