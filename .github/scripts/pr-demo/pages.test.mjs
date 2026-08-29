import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { waitForPublishedManifest } from "./pages.mjs";

const headSha = "b".repeat(40);
const url = `https://seikatu-gakari.github.io/volunty/pr/321/${headSha}/manifest.json`;
const currentManifestText = `${JSON.stringify({ headSha, tag: "@demo-321" }, null, 2)}\n`;
const manifestSha256 = createHash("sha256").update(currentManifestText).digest("hex");

test("Pagesが最新HEAD manifestを返すまで再試行する", async () => {
  const responses = [
    { ok: true, text: async () => JSON.stringify({ headSha: "a".repeat(40) }) },
    { ok: true, text: async () => currentManifestText },
  ];
  let calls = 0;

  const manifest = await waitForPublishedManifest({
    url,
    headSha,
    manifestSha256,
    attempts: 2,
    intervalMs: 0,
    fetchImpl: async () => responses[calls++],
    sleepImpl: async () => {},
  });

  assert.equal(manifest.headSha, headSha);
  assert.equal(calls, 2);
});

test("Pagesが古いHEADのままなら成功にしない", async () => {
  await assert.rejects(
    waitForPublishedManifest({
      url,
      headSha,
      manifestSha256,
      attempts: 2,
      intervalMs: 0,
      fetchImpl: async () => ({
        ok: true,
        text: async () => JSON.stringify({ headSha: "a".repeat(40) }),
      }),
      sleepImpl: async () => {},
    }),
    /今回のmanifestを確認できません/,
  );
});

test("同じHEADでも今回配置したmanifest本文と異なれば成功にしない", async () => {
  await assert.rejects(
    waitForPublishedManifest({
      url,
      headSha,
      manifestSha256,
      attempts: 1,
      intervalMs: 0,
      fetchImpl: async () => ({
        ok: true,
        text: async () => `${JSON.stringify({ headSha, tag: "@demo-old" }, null, 2)}\n`,
      }),
      sleepImpl: async () => {},
    }),
    /今回のmanifestを確認できません/,
  );
});
