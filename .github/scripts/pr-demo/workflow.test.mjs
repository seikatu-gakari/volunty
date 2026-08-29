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

function jobBlock(name, nextName) {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  const end = nextName
    ? workflow.indexOf(`\n  ${nextName}:\n`, start + 1)
    : workflow.length;
  assert.notEqual(start, -1, `${name} jobが必要です`);
  assert.notEqual(end, -1, `${nextName} jobが必要です`);
  return workflow.slice(start, end);
}

test("publisherとfinalizerをActionsの単一pending枠へ入れずdurable lockで直列化する", () => {
  const invalidate = jobBlock("invalidate", "publish");
  const publish = jobBlock("publish", "finalize");
  const finalize = jobBlock("finalize");

  assert.doesNotMatch(invalidate, /concurrency:/);
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
