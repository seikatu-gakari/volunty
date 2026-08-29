import assert from "node:assert/strict";
import test from "node:test";

import { createDecision } from "./decision.mjs";

const body = `<!-- pr-demo:v1
required: true
spec: e2e/participant-discovery.spec.ts
tag: @demo-221
viewports: desktop
reason:
-->`;

test("GitHub pull_request eventをpublisherが照合できるdecisionへ変換する", () => {
  const event = {
    repository: { full_name: "seikatu-gakari/volunty" },
    pull_request: {
      number: 321,
      body,
      labels: [{ name: "demo-video" }],
      base: {
        sha: "a".repeat(40),
        repo: { full_name: "seikatu-gakari/volunty" },
      },
      head: {
        sha: "b".repeat(40),
        repo: { full_name: "seikatu-gakari/volunty" },
      },
    },
  };

  const result = createDecision(event, ["app/src/app/page.tsx"]);

  assert.equal(result.prNumber, 321);
  assert.equal(result.baseSha, "a".repeat(40));
  assert.equal(result.headSha, "b".repeat(40));
  assert.equal(result.baseRepository, "seikatu-gakari/volunty");
  assert.equal(result.headRepository, "seikatu-gakari/volunty");
  assert.equal(result.outcome, "capture");
  assert.deepEqual(result.changedFiles, ["app/src/app/page.tsx"]);
});

test("pull_request payloadがないeventを拒否する", () => {
  assert.throws(
    () => createDecision({ repository: { full_name: "x/y" } }, []),
    /pull_request eventが必要です/,
  );
});
