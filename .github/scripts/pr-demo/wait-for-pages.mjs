#!/usr/bin/env node

import { waitForPublishedManifest } from "./pages.mjs";

const url = process.env.PR_DEMO_MANIFEST_URL;
const headSha = process.env.PR_DEMO_HEAD_SHA;
const manifestSha256 = process.env.PR_DEMO_MANIFEST_SHA256;
if (!url || !headSha || !manifestSha256) {
  throw new Error("PR_DEMO_MANIFEST_URL、PR_DEMO_HEAD_SHA、PR_DEMO_MANIFEST_SHA256が必要です");
}

await waitForPublishedManifest({ url, headSha, manifestSha256 });
console.log(`[pr-demo] Pagesで今回のmanifest ${manifestSha256} を確認しました`);
