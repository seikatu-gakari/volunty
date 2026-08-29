import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDemoPolicy } from "./policy.mjs";

const repository = "seikatu-gakari/volunty";
const requiredBody = `<!-- pr-demo:v1
required: true
spec: e2e/participant-discovery.spec.ts
tag: @demo-221
viewports: desktop
reason:
-->`;
const skippedBody = `<!-- pr-demo:v1
required: false
spec:
tag:
viewports:
reason: 表示を変えない内部整理
-->`;

function evaluate(overrides = {}) {
  return evaluateDemoPolicy({
    body: "",
    labels: [],
    changedFiles: [],
    baseRepository: repository,
    headRepository: repository,
    ...overrides,
  });
}

test("UI変更と有効な契約があれば録画する", () => {
  const result = evaluate({
    body: requiredBody,
    changedFiles: ["app/src/app/opportunities/page.tsx"],
  });

  assert.equal(result.outcome, "capture");
  assert.equal(result.required, true);
  assert.equal(result.uiChange, true);
  assert.equal(result.contract.tag, "@demo-221");
});

test("ドキュメント変更だけなら契約なしで対象外にする", () => {
  const result = evaluate({ changedFiles: ["docs/branch-workflow.md"] });

  assert.deepEqual(result, {
    schemaVersion: 1,
    outcome: "skip",
    required: false,
    uiChange: false,
    reason: "ユーザー表示に影響する変更がありません",
    contract: null,
  });
});

for (const path of [
  "app/src/app/opportunities/page.tsx",
  "app/public/lp/hero.webp",
  "app/src/app/globals.css",
]) {
  test(`UI path ${path} に契約がなければ失敗する`, () => {
    const result = evaluate({ changedFiles: [path] });
    assert.equal(result.outcome, "error");
    assert.match(result.reason, /pr-demo契約が必要です/);
  });
}

test("APIとテストだけの変更はUI変更に分類しない", () => {
  const result = evaluate({
    changedFiles: [
      "app/src/app/api/test-auth/login/route.ts",
      "app/src/app/components/Header.test.tsx",
    ],
  });

  assert.equal(result.outcome, "skip");
  assert.equal(result.uiChange, false);
});

test("UI変更を対象外にするにはラベルと理由の両方を要求する", () => {
  const withoutLabel = evaluate({
    body: skippedBody,
    changedFiles: ["app/src/app/components/Header.tsx"],
  });
  assert.equal(withoutLabel.outcome, "error");
  assert.match(withoutLabel.reason, /demo-not-required/);

  const withLabel = evaluate({
    body: skippedBody,
    labels: ["demo-not-required"],
    changedFiles: ["app/src/app/components/Header.tsx"],
  });
  assert.equal(withLabel.outcome, "skip");
  assert.equal(withLabel.reason, "表示を変えない内部整理");
});

test("demo-videoラベルは非UI pathでも有効な契約を必須にする", () => {
  const result = evaluate({
    body: requiredBody,
    labels: ["demo-video"],
    changedFiles: ["app/src/lib/recommendations/engine.ts"],
  });

  assert.equal(result.outcome, "capture");
  assert.equal(result.required, true);
});

test("demo-videoとdemo-not-requiredの競合を拒否する", () => {
  const result = evaluate({
    body: requiredBody,
    labels: ["demo-video", "demo-not-required"],
    changedFiles: ["app/src/app/page.tsx"],
  });

  assert.equal(result.outcome, "error");
  assert.match(result.reason, /同時に指定できません/);
});

test("fork由来PRもread-only CIで録画し公開可否はprivileged workflowへ委ねる", () => {
  const result = evaluate({
    body: requiredBody,
    changedFiles: ["app/src/app/page.tsx"],
    headRepository: "outside/fork",
  });

  assert.equal(result.outcome, "capture");
  assert.equal(result.required, true);
});

test("壊れた契約をpolicy errorへ変換する", () => {
  const result = evaluate({
    body: requiredBody.replace("@demo-221", "@demo-221;rm"),
    changedFiles: ["app/src/app/page.tsx"],
  });

  assert.equal(result.outcome, "error");
  assert.match(result.reason, /tagは@demo/);
});
