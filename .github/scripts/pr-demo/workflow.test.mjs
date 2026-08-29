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
  assert.match(invalidate, /timeout-minutes: 90/);
  assert.match(invalidate, /contents: write/);
  assert.match(invalidate, /id: pages_lock[\s\S]*pages-lock\.mjs acquire/);
  assert.ok(
    invalidate.indexOf("pages-lock.mjs acquire") <
      invalidate.indexOf("invalidate-status.mjs"),
  );
  assert.match(invalidate, /pages-lock\.mjs release/);
  assert.doesNotMatch(publish, /concurrency:/);
  assert.match(publish, /id: pages_lock[\s\S]*pages-lock\.mjs acquire/);
  assert.ok(
    publish.indexOf("pages-lock.mjs acquire") <
      publish.indexOf("Checkout historyless Pages branch"),
  );
  assert.match(
    publish,
    /Release GitHub Pages publish lock[\s\S]*if: \$\{\{ always\(\)/,
  );
  assert.match(publish, /pages-lock\.mjs release/);
  assert.doesNotMatch(publish, /finalize-publish\.mjs/);
  assert.match(finalize, /needs: publish/);
  assert.doesNotMatch(finalize, /concurrency:/);
  assert.match(finalize, /id: pages_lock[\s\S]*pages-lock\.mjs acquire/);
  assert.ok(
    finalize.indexOf("pages-lock.mjs acquire") <
      finalize.indexOf("finalize-publish.mjs"),
  );
  assert.match(
    finalize,
    /Release PR demo operation lock[\s\S]*if: \$\{\{ always\(\)/,
  );
  assert.match(finalize, /pages-lock\.mjs release/);
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
  assert.match(cleanupWorkflow, /pages-lock\.mjs acquire/);
  assert.ok(
    cleanupWorkflow.indexOf("pages-lock.mjs acquire") <
      cleanupWorkflow.indexOf("Checkout historyless Pages branch"),
  );
  assert.match(cleanupWorkflow, /pages-lock\.mjs release/);
});
