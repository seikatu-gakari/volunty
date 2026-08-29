#!/usr/bin/env node

import { waitForPublishedManifest } from "./pages.mjs";

const url = process.env.PR_DEMO_MANIFEST_URL;
const headSha = process.env.PR_DEMO_HEAD_SHA;
if (!url || !headSha) {
  throw new Error("PR_DEMO_MANIFEST_URLとPR_DEMO_HEAD_SHAが必要です");
}

await waitForPublishedManifest({ url, headSha });
console.log(`[pr-demo] Pagesで最新HEAD ${headSha} を確認しました`);
