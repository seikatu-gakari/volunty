import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../../workflows/pr-demo-publish.yml", import.meta.url),
  "utf8",
);
const cleanupWorkflow = await readFile(
  new URL("../../workflows/pr-demo-cleanup.yml", import.meta.url),
  "utf8",
);
const ciWorkflow = await readFile(
  new URL("../../workflows/ci.yml", import.meta.url),
  "utf8",
);

function jobBlock(name, nextName, source = workflow) {
  const start = source.indexOf(`\n  ${name}:\n`);
  const end = nextName
    ? source.indexOf(`\n  ${nextName}:\n`, start + 1)
    : source.length;
  assert.notEqual(start, -1, `${name} jobが必要です`);
  assert.notEqual(end, -1, `${nextName} jobが必要です`);
  return source.slice(start, end);
}

test("publisherとfinalizerをActionsの単一pending枠へ入れずdurable lockで直列化する", () => {
  const invalidate = jobBlock("invalidate", "publish");
  const publish = jobBlock("publish", "finalize");
  const finalize = jobBlock("finalize");

  assert.doesNotMatch(invalidate, /concurrency:/);
  assert.match(invalidate, /timeout-minutes: 120/);
  assert.match(invalidate, /contents: write/);
  assert.match(invalidate, /PR_DEMO_LOCK_SCOPE: status/);
  assert.match(invalidate, /PR_DEMO_LOCKED_COMMAND_TIMEOUT_MS: 900000/);
  assert.match(
    invalidate,
    /pages-lock\.mjs run-status \.github\/scripts\/pr-demo\/invalidate-status\.mjs/,
  );
  assert.equal(invalidate.match(/invalidate-status\.mjs/g)?.length, 1);
  assert.equal(invalidate.match(/PR_DEMO_LOCK_SCOPE: status/g)?.length, 1);
  assert.doesNotMatch(invalidate, /pages-lock\.mjs (?:acquire|release)/);
  assert.doesNotMatch(publish, /concurrency:/);
  assert.doesNotMatch(publish, /PR_DEMO_LOCK_SCOPE: status/);
  assert.match(publish, /timeout-minutes: 120/);
  assert.match(publish, /id: pages_lock[\s\S]*pages-lock\.mjs acquire/);
  assert.ok(
    publish.indexOf("pages-lock.mjs acquire") <
      publish.indexOf("Checkout historyless Pages branch"),
  );
  assert.ok(
    publish.indexOf("Replace gh-pages with one historyless commit") <
      publish.indexOf("Deploy GitHub Pages"),
  );
  assert.match(
    publish,
    /Release GitHub Pages publish lock[\s\S]*if: \$\{\{ always\(\)/,
  );
  assert.match(publish, /pages-lock\.mjs release/);
  assert.doesNotMatch(publish, /finalize-publish\.mjs/);
  assert.match(finalize, /needs: publish/);
  assert.match(finalize, /timeout-minutes: 120/);
  assert.doesNotMatch(finalize, /concurrency:/);
  assert.equal(finalize.match(/PR_DEMO_LOCK_SCOPE: status/g)?.length, 1);
  assert.match(finalize, /PR_DEMO_LOCKED_COMMAND_TIMEOUT_MS: 900000/);
  assert.match(
    finalize,
    /pages-lock\.mjs run-status source\/\.github\/scripts\/pr-demo\/finalize-publish\.mjs/,
  );
  assert.doesNotMatch(finalize, /pages-lock\.mjs (?:acquire|release)/);
  assert.match(finalize, /id: handoff[\s\S]*continue-on-error: true/);
  assert.match(finalize, /finalize-publish\.mjs/);
});

test("finalize単独再実行でもpublish元attemptのhandoffを取得する", () => {
  const publish = jobBlock("publish", "finalize");
  const finalize = jobBlock("finalize");

  assert.match(
    publish,
    /finalizer_artifact_name: \$\{\{ steps\.handoff\.outputs\.artifact_name \}\}/,
  );
  assert.match(
    publish,
    /artifact_name=pr-demo-finalizer-\$\{GITHUB_RUN_ATTEMPT\}/,
  );
  assert.match(
    publish,
    /name: \$\{\{ steps\.handoff\.outputs\.artifact_name \}\}/,
  );
  assert.match(
    finalize,
    /name: \$\{\{ needs\.publish\.outputs\.finalizer_artifact_name \}\}/,
  );
  assert.doesNotMatch(finalize, /pr-demo-finalizer-\$\{\{ github\.run_attempt \}\}/);
});

test("e2e単独再実行でもdemo-policy元attemptのdecisionを取得する", () => {
  const demoPolicy = jobBlock("demo-policy", "quality", ciWorkflow);
  const e2e = jobBlock("e2e", undefined, ciWorkflow);

  assert.match(
    demoPolicy,
    /decision_artifact_name: \$\{\{ steps\.decision_artifact\.outputs\.name \}\}/,
  );
  assert.match(
    demoPolicy,
    /name=pr-demo-decision-\$\{GITHUB_RUN_ATTEMPT\}/,
  );
  assert.match(
    demoPolicy,
    /name: \$\{\{ steps\.decision_artifact\.outputs\.name \}\}/,
  );
  assert.match(
    e2e,
    /name: \$\{\{ needs\.demo-policy\.outputs\.decision_artifact_name \}\}/,
  );
  assert.doesNotMatch(e2e, /pr-demo-decision-\$\{\{ github\.run_attempt \}\}/);
});

test("qualityは現在runのdemo-video pending確認後だけ成功経路へ進む", () => {
  const quality = jobBlock("quality", "rls", ciWorkflow);

  assert.match(quality, /timeout-minutes: 120/);
  assert.match(quality, /statuses: read/);
  assert.match(
    quality,
    /PR_DEMO_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/,
  );
  assert.match(quality, /PR_DEMO_SOURCE_RUN_ID: \$\{\{ github\.run_id \}\}/);
  assert.match(
    quality,
    /PR_DEMO_SOURCE_RUN_ATTEMPT: \$\{\{ github\.run_attempt \}\}/,
  );
  assert.match(quality, /wait-for-invalidation\.mjs/);
  assert.ok(
    quality.indexOf("wait-for-invalidation.mjs") <
      quality.indexOf("Install dependencies"),
  );
  assert.doesNotMatch(quality, /needs:/);
});

test("fork手動承認はAPI障害時のfailure対象identityも必須入力にする", () => {
  assert.match(workflow, /pr_number:[\s\S]*required: true/);
  assert.match(workflow, /head_sha:[\s\S]*required: true/);
  assert.match(
    workflow,
    /head_sha: \$\{\{ steps\.prepare\.outputs\.head_sha \|\| github\.event\.workflow_run\.head_sha \|\| inputs\.head_sha \}\}/,
  );
});

test("cleanupも同じdurable Pages lock内で実行する", () => {
  assert.doesNotMatch(cleanupWorkflow, /^concurrency:/m);
  assert.match(cleanupWorkflow, /timeout-minutes: 120/);
  assert.match(cleanupWorkflow, /pages-lock\.mjs acquire/);
  assert.ok(
    cleanupWorkflow.indexOf("pages-lock.mjs acquire") <
      cleanupWorkflow.indexOf("Checkout historyless Pages branch"),
  );
  assert.ok(
    cleanupWorkflow.indexOf("Replace gh-pages with cleaned historyless commit") <
      cleanupWorkflow.indexOf("Deploy cleaned GitHub Pages"),
  );
  assert.ok(
    cleanupWorkflow.indexOf("Deploy cleaned GitHub Pages") <
      cleanupWorkflow.indexOf("Mark PR comments as expired"),
  );
  assert.match(
    cleanupWorkflow,
    /Mark PR comments as expired[\s\S]*steps\.persist\.outcome == 'success'[\s\S]*steps\.deploy\.outcome == 'success'/,
  );
  assert.match(
    cleanupWorkflow,
    /Persist completed cleanup state[\s\S]*steps\.comments\.outcome == 'success'/,
  );
  assert.match(cleanupWorkflow, /pages-lock\.mjs release/);
});
