import assert from "node:assert/strict";
import test from "node:test";

import { confirmPublishFreshness } from "./confirm-publish-freshness.mjs";

const repository = "seikatu-gakari/volunty";
const headSha = "b".repeat(40);

function publishResult() {
  return {
    schemaVersion: 1,
    outcome: "skip",
    siteChanged: true,
    prNumber: 321,
    headSha,
    repository,
    runId: 987,
    runAttempt: 2,
    runUrl: `https://github.com/${repository}/actions/runs/987/attempts/2`,
    reason: "対象外",
  };
}

function currentClient(overrides = {}) {
  return {
    async getPullRequest(prNumber) {
      assert.equal(prNumber, 321);
      return { head: { sha: headSha } };
    },
    async getLatestPullRequestCiRun(prNumber, sha) {
      assert.equal(prNumber, 321);
      assert.equal(sha, headSha);
      return { id: 987, run_attempt: 2, status: "completed" };
    },
    ...overrides,
  };
}

test("current HEADの最新run attemptだけをPages公開直前に受理する", async () => {
  const result = publishResult();

  assert.equal(
    await confirmPublishFreshness({ result, client: currentClient() }),
    result,
  );
});

test("準備後にPR HEADが進んだ場合は古いPages treeを拒否する", async () => {
  await assert.rejects(
    confirmPublishFreshness({
      result: publishResult(),
      client: currentClient({
        async getPullRequest() {
          return { head: { sha: "c".repeat(40) } };
        },
      }),
    }),
    /PRのcurrent HEADではありません/,
  );
});

test("同一HEADで新しいCI runが始まった場合は古いPages treeを拒否する", async () => {
  await assert.rejects(
    confirmPublishFreshness({
      result: publishResult(),
      client: currentClient({
        async getLatestPullRequestCiRun() {
          return { id: 988, run_attempt: 1, status: "in_progress" };
        },
      }),
    }),
    /最新Pull Request CIではありません/,
  );
});
