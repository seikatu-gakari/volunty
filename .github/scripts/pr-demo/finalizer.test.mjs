import assert from "node:assert/strict";
import test from "node:test";

import { finalizeHandoffFailure, finalizePublish } from "./finalizer.mjs";

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
    runId: 987,
    runAttempt: 1,
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
    siteReady: true,
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
    siteReady: true,
    pagesReady: false,
    client: createClient(calls),
  });

  assert.equal(outcome.success, false);
  assert.match(calls[0].body, /Pagesで最新HEAD/);
  assert.equal(calls[1].status.state, "failure");
});

test("Pages確認済みでもgh-pages永続化に失敗したらfailureにする", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult(),
    siteReady: false,
    pagesReady: true,
    client: createClient(calls),
  });

  assert.equal(outcome.success, false);
  assert.match(calls[0].body, /gh-pages/);
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
    siteReady: true,
    pagesReady: true,
    client: createClient(calls),
  });

  assert.equal(outcome.state, "stale");
  assert.deepEqual(calls, []);
});

test("公開処理中に同じHEADの新しいCI runが始まった場合も更新しない", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult(),
    currentHeadSha: headSha,
    latestRunId: 988,
    latestRunAttempt: 1,
    siteReady: true,
    pagesReady: true,
    client: createClient(calls),
  });

  assert.equal(outcome.state, "stale");
  assert.deepEqual(calls, []);
});

test("公開処理中に同じrun IDの新しいattemptが始まった場合も更新しない", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({ runAttempt: 1 }),
    currentHeadSha: headSha,
    latestRunId: 987,
    latestRunAttempt: 2,
    siteReady: true,
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

test("手動承認後に遅延した自動fork finalizerはsuccessを上書きしない", async () => {
  const calls = [];
  const client = {
    ...createClient(calls),
    async getLatestDemoStatus() {
      return {
        context: "demo-video",
        state: "pending",
        target_url: runUrl,
      };
    },
    async hasManualForkApproval(identity) {
      assert.equal(identity.prNumber, 321);
      assert.equal(identity.headSha, headSha);
      assert.equal(identity.runId, 987);
      assert.equal(identity.runAttempt, 1);
      return true;
    },
  };

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "failure",
      siteChanged: false,
      reason: "fork由来のPRは自動公開しません",
      manifestUrl: undefined,
      comment: undefined,
      unapprovedFork: true,
    }),
    currentHeadSha: headSha,
    latestRunId: 987,
    latestRunAttempt: 1,
    siteReady: true,
    pagesReady: false,
    client,
  });

  assert.deepEqual(outcome, { success: true, state: "stale" });
  assert.deepEqual(calls, []);
});

test("手動承認stateがない自動fork finalizerはfailureを維持する", async () => {
  const calls = [];
  const client = {
    ...createClient(calls),
    async getLatestDemoStatus() {
      return {
        context: "demo-video",
        state: "pending",
        target_url: runUrl,
      };
    },
    async hasManualForkApproval() {
      return false;
    },
  };

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "failure",
      siteChanged: false,
      reason: "fork由来のPRは自動公開しません",
      manifestUrl: undefined,
      comment: undefined,
      unapprovedFork: true,
    }),
    currentHeadSha: headSha,
    latestRunId: 987,
    latestRunAttempt: 1,
    siteReady: true,
    pagesReady: false,
    client,
  });

  assert.equal(outcome.success, false);
  assert.deepEqual(calls.map((call) => call.type), ["comment", "status"]);
  assert.equal(calls[1].status.state, "failure");
});

test("手動承認success済みならstate fileの反映待ちでも自動fork finalizerをstaleにする", async () => {
  const calls = [];
  let approvalStateCalls = 0;
  const client = {
    ...createClient(calls),
    async getLatestDemoStatus() {
      return {
        context: "demo-video",
        state: "success",
        target_url: manifestUrl,
      };
    },
    async hasManualForkApproval() {
      approvalStateCalls += 1;
      return false;
    },
  };

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "failure",
      siteChanged: false,
      reason: "fork由来のPRは自動公開しません",
      manifestUrl: undefined,
      comment: undefined,
      unapprovedFork: true,
    }),
    currentHeadSha: headSha,
    latestRunId: 987,
    latestRunAttempt: 1,
    siteReady: true,
    pagesReady: false,
    client,
  });

  assert.deepEqual(outcome, { success: true, state: "stale" });
  assert.equal(approvalStateCalls, 0);
  assert.deepEqual(calls, []);
});

test("生成失敗時の旧動画削除をdeploy・永続化できなければ明示的にfailureにする", async () => {
  const calls = [];

  const outcome = await finalizePublish({
    result: baseResult({
      outcome: "failure",
      siteChanged: true,
      reason: "対象テストが0件でした",
      manifestUrl: undefined,
      comment: undefined,
    }),
    siteReady: false,
    pagesReady: false,
    client: createClient(calls),
  });

  assert.equal(outcome.success, false);
  assert.match(calls[0].body, /対象テストが0件でした/);
  assert.match(calls[0].body, /旧動画.*削除できませんでした/);
  assert.equal(calls[1].status.state, "failure");
});

test("finalizer handoff取得失敗でも最新HEADのfailure statusを確定する", async () => {
  const calls = [];
  const event = {
    repository: { full_name: repository },
    workflow_run: {
      id: 987,
      run_attempt: 1,
      name: "Pull Request CI",
      event: "pull_request",
      conclusion: "success",
      head_sha: headSha,
      head_repository: { full_name: repository },
      html_url: runUrl,
      pull_requests: [{ number: 321, head: { sha: headSha } }],
    },
  };
  const client = {
    ...createClient(calls),
    async getLatestPullRequestCiRun() {
      return { id: 987, run_attempt: 1 };
    },
    async getPullRequest() {
      return { head: { sha: headSha } };
    },
  };

  const outcome = await finalizeHandoffFailure({
    event,
    reason: "finalizer handoffを取得できませんでした",
    client,
  });

  assert.equal(outcome.success, false);
  assert.match(calls[0].body, /handoff/);
  assert.equal(calls[1].status.state, "failure");
});

test("forkのhandoff欠落finalizerも手動承認済みなら上書きしない", async () => {
  const calls = [];
  const event = {
    repository: { full_name: repository },
    workflow_run: {
      id: 987,
      run_attempt: 1,
      name: "Pull Request CI",
      event: "pull_request",
      conclusion: "success",
      head_sha: headSha,
      head_repository: { full_name: "someone/volunty" },
      html_url: runUrl,
      pull_requests: [{ number: 321, head: { sha: headSha } }],
    },
  };
  const client = {
    ...createClient(calls),
    async getLatestPullRequestCiRun() {
      return { id: 987, run_attempt: 1 };
    },
    async getPullRequest() {
      return { head: { sha: headSha } };
    },
    async getLatestDemoStatus() {
      return {
        context: "demo-video",
        state: "pending",
        target_url: runUrl,
      };
    },
    async hasManualForkApproval() {
      return true;
    },
  };

  const outcome = await finalizeHandoffFailure({
    event,
    reason: "finalizer handoffを取得できませんでした",
    client,
  });

  assert.equal(outcome.state, "stale");
  assert.deepEqual(calls, []);
});
