import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../../workflows/pr-demo-publish.yml", import.meta.url),
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

test("publisher finalizerとinvalidatorのstatus更新を同じHEAD lockで直列化する", () => {
  const invalidate = jobBlock("invalidate", "publish");
  const publish = jobBlock("publish", "finalize");
  const finalize = jobBlock("finalize");

  assert.match(
    invalidate,
    /group: \$\{\{ github\.repository \}\}-pr-demo-status-\$\{\{ github\.event\.workflow_run\.head_sha \}\}/,
  );
  assert.match(invalidate, /cancel-in-progress: true/);
  assert.match(publish, /group: \$\{\{ github\.repository \}\}-pr-demo-pages/);
  assert.doesNotMatch(publish, /finalize-publish\.mjs/);
  assert.match(finalize, /needs: publish/);
  assert.match(
    finalize,
    /group: \$\{\{ github\.repository \}\}-pr-demo-status-\$\{\{ needs\.publish\.outputs\.head_sha \}\}/,
  );
  assert.match(finalize, /id: handoff[\s\S]*continue-on-error: true/);
  assert.match(finalize, /finalize-publish\.mjs/);
});
