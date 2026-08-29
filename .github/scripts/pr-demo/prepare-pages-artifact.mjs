#!/usr/bin/env node

import { preparePublicSiteDirectory } from "./site.mjs";

const siteDirectory = process.env.PR_DEMO_SITE_DIR;
const publicDirectory = process.env.PR_DEMO_PUBLIC_SITE_DIR;
if (!siteDirectory || !publicDirectory) {
  throw new Error("PR_DEMO_SITE_DIRとPR_DEMO_PUBLIC_SITE_DIRが必要です");
}

const demos = await preparePublicSiteDirectory({
  siteDirectory,
  publicDirectory,
});
console.log(`[pr-demo] 公開用Pages treeを準備しました: ${demos.length}件`);
