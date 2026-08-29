import assert from "node:assert/strict";
import test from "node:test";

import { finalizePublish } from "./finalizer.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);
const runUrl = `https://github.com/${repository}/actions/runs/987`;
const manifestUrl = `https://seikatu-gakari.github.io/volunty/pr/321/${headSha}/manifest.json`;

function createClient(calls, { demoCommentExists = false } = {}) {
  return {
    async upsertDemoComment(prNumber, body, options = {}) {
      if (options.createIfMissing === false && !demoCommentExists) {
        return null;
      }
      calls.push({ type: "comment", prNumber, body });
      return { id: 99 };
    },
    async setDemoStatus(sha, status) {
      calls.push({ type: "status", sha, status });
    },
  };
}

function baseResult(overrides) {
  return {
    schemaVersion: 1,
    outcome: "published",
    siteChanged: true,
    prNumber: 321,
    headSha,
    repository,
    runUrl,
    reason: "動作ビデオを公開しました",
    manifestUrl,
    manifestSha256: "d".repeat(64),
    comment: "<!-- pr-demo-comment:v1 -->\n## 🎬 動作ビデオ",
    ...overrides,
  };
}

test("Pagesの最新HEAD確認後だけcommentを更新してstatusをsuccessにする", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult(),
    pagesReady: true,
    client: createClient(calls),
  });

  assert.equal(outcome.success, true);
  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.equal(calls[1].status.state, "success");
  assert.equal(calls[1].status.targetUrl, manifestUrl);
});

test("Pagesが最新HEADでなければfailure commentとstatusにする", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult(),
    pagesReady: false,
    client: createClient(calls),
  });

  assert.equal(outcome.success, false);
  assert.match(calls[0].body, /Pagesで最新HEAD/);
  assert.equal(calls[1].status.state, "failure");
});

test("対象外PRはcommentを作らずdemo-videoをsuccessにする", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "skip",
      siteChanged: false,
      reason: "ユーザー表示に影響する変更がありません",
      manifestUrl: undefined,
      comment: undefined,
    }),
    pagesReady: false,
    client: createClient(calls),
  });

  assert.equal(outcome.success, true);
  assert.deepEqual(calls.map((call) => call.type), ["status"]);
  assert.equal(calls[0].status.state, "success");
  assert.match(calls[0].status.description, /対象外/);
});

test("対象外PRの旧動画削除deployが失敗したらdemo-videoをfailureにする", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "skip",
      siteChanged: true,
      reason: "ユーザー表示に影響する変更がありません",
      manifestUrl: undefined,
      comment: undefined,
    }),
    siteReady: false,
    pagesReady: false,
    client: createClient(calls),
  });

  assert.equal(outcome.success, false);
  assert.match(calls[0].body, /旧動画/);
  assert.equal(calls[1].status.state, "failure");
});

test("旧動画を削除した対象外PRはcommentも最新HEADの対象外表示へ更新する", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "skip",
      siteChanged: true,
      reason: "最新差分はドキュメントだけです",
      manifestUrl: undefined,
      comment: undefined,
    }),
    siteReady: true,
    pagesReady: false,
    client: createClient(calls, { demoCommentExists: true }),
  });

  assert.equal(outcome.success, true);
  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.match(calls[0].body, /対象外/);
  assert.match(calls[0].body, new RegExp(headSha));
  assert.equal(calls[1].status.state, "success");
});

test("既存failureコメントだけがある対象外PRも最新HEADの対象外表示へ更新する", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "skip",
      siteChanged: false,
      reason: "最新差分はドキュメントだけです",
      manifestUrl: undefined,
      comment: undefined,
    }),
    siteReady: true,
    pagesReady: false,
    client: createClient(calls, { demoCommentExists: true }),
  });

  assert.equal(outcome.success, true);
  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.match(calls[0].body, /対象外/);
  assert.match(calls[0].body, new RegExp(headSha));
  assert.equal(calls[1].status.state, "success");
});

test("古いworkflow_runはcommentとstatusを一切更新しない", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "stale",
      siteChanged: false,
      reason: "PRの最新HEADではありません",
      manifestUrl: undefined,
      comment: undefined,
    }),
    pagesReady: false,
    client: createClient(calls),
  });

  assert.equal(outcome.success, true);
  assert.deepEqual(calls, []);
});

test("公開処理中にPR HEADが進んだ場合もcommentとstatusを更新しない", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult(),
    currentHeadSha: "c".repeat(40),
    pagesReady: true,
    client: createClient(calls),
  });

  assert.equal(outcome.state, "stale");
  assert.deepEqual(calls, []);
});

test("CIまたはartifact失敗は理由付きcommentとfailure statusにする", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "failure",
      siteChanged: false,
      reason: "対象テストが0件でした",
      manifestUrl: undefined,
      comment: undefined,
    }),
    pagesReady: false,
    client: createClient(calls),
  });

  assert.equal(outcome.success, false);
  assert.match(calls[0].body, /対象テストが0件でした/);
  assert.equal(calls[1].status.state, "failure");
});
