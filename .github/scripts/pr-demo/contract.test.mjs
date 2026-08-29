import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDemoContract } from "./contract.mjs";

test("有効なpr-demo:v1契約を構造化する", () => {
  const body = `## Demo

<!-- pr-demo:v1
required: true
spec: e2e/participant-discovery.spec.ts
tag: @demo-221
viewports: desktop,mobile
reason:
-->`;

  assert.deepEqual(parseDemoContract(body), {
    version: 1,
    required: true,
    spec: "e2e/participant-discovery.spec.ts",
    tag: "@demo-221",
    viewports: ["desktop", "mobile"],
    reason: "",
  });
});

test("specのpath traversalを拒否する", () => {
  const body = `<!-- pr-demo:v1
required: true
spec: e2e/../src/secret.spec.ts
tag: @demo-221
viewports: desktop
reason:
-->`;

  assert.throws(
    () => parseDemoContract(body),
    /specはe2e配下の\.spec\.tsを指定してください/,
  );
});

test("required:falseは理由だけを保持する", () => {
  const body = `<!-- pr-demo:v1
required: false
spec:
tag:
viewports:
reason: ドキュメントのみ
-->`;

  assert.deepEqual(parseDemoContract(body), {
    version: 1,
    required: false,
    spec: null,
    tag: null,
    viewports: [],
    reason: "ドキュメントのみ",
  });
});

for (const [name, body, message] of [
  [
    "shell文字を含むtag",
    `<!-- pr-demo:v1
required: true
spec: e2e/example.spec.ts
tag: @demo-221;rm
viewports: desktop
reason:
-->`,
    /tagは@demo-<Issue番号>/,
  ],
  [
    "未対応viewport",
    `<!-- pr-demo:v1
required: true
spec: e2e/example.spec.ts
tag: @demo-221
viewports: tablet
reason:
-->`,
    /viewportsはdesktopまたはmobile/,
  ],
  [
    "重複viewport",
    `<!-- pr-demo:v1
required: true
spec: e2e/example.spec.ts
tag: @demo-221
viewports: desktop,desktop
reason:
-->`,
    /viewportsを重複指定できません/,
  ],
  [
    "逆順viewport",
    `<!-- pr-demo:v1
required: true
spec: e2e/example.spec.ts
tag: @demo-221
viewports: mobile,desktop
reason:
-->`,
    /desktop,mobileの順で指定してください/,
  ],
  [
    "falseの理由なし",
    `<!-- pr-demo:v1
required: false
spec:
tag:
viewports:
reason:
-->`,
    /required:falseではreasonが必要です/,
  ],
]) {
  test(`${name}を拒否する`, () => {
    assert.throws(() => parseDemoContract(body), message);
  });
}

test("契約ブロックが複数ある場合は拒否する", () => {
  const block = `<!-- pr-demo:v1
required: false
spec:
tag:
viewports:
reason: 対象外
-->`;

  assert.throws(
    () => parseDemoContract(`${block}\n${block}`),
    /pr-demo契約は1つだけ指定してください/,
  );
});

test("壊れたpr-demo markerを契約なしとして見逃さない", () => {
  const malformed = `<!-- pr-demo:v1 required: false
spec:
tag:
viewports:
reason: UI変更なし
-->`;

  assert.throws(() => parseDemoContract(malformed), /形式が不正/);
});

test("有効契約のほかに壊れたpr-demo markerがあれば拒否する", () => {
  const valid = `<!-- pr-demo:v1
required: false
spec:
tag:
viewports:
reason: UI変更なし
-->`;

  assert.throws(
    () => parseDemoContract(`${valid}\n<!-- pr-demo:v1 broken -->`),
    /形式が不正/,
  );
});

test("repositoryのPR templateには有効な対象外default契約が1件ある", async () => {
  const template = await readFile(
    new URL("../../pull_request_template.md", import.meta.url),
    "utf8",
  );

  const contract = parseDemoContract(template);
  assert.equal(contract.required, false);
  assert.match(contract.reason, /ユーザー表示に影響する変更なし/);
});
