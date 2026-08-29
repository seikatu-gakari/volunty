import assert from "node:assert/strict";
import test from "node:test";

import { waitForPublishedManifest } from "./pages.mjs";

const headSha = "b".repeat(40);
const url = `https://seikatu-gakari.github.io/volunty/pr/321/${headSha}/manifest.json`;

test("Pagesが最新HEAD manifestを返すまで再試行する", async () => {
  const responses = [
    { ok: true, text: async () => JSON.stringify({ headSha: "a".repeat(40) }) },
    { ok: true, text: async () => JSON.stringify({ headSha }) },
  ];
  let calls = 0;

  const manifest = await waitForPublishedManifest({
    url,
    headSha,
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
      attempts: 2,
      intervalMs: 0,
      fetchImpl: async () => ({
        ok: true,
        text: async () => JSON.stringify({ headSha: "a".repeat(40) }),
      }),
      sleepImpl: async () => {},
    }),
    /最新HEADのmanifestを確認できません/,
  );
});
