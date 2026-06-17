#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const workflowPath = new URL(
  "../.github/workflows/production-db-migrate.yml",
  import.meta.url
);

assert.ok(
  existsSync(workflowPath),
  ".github/workflows/production-db-migrate.yml が存在しません"
);

const workflow = readFileSync(workflowPath, "utf8");

function includesRequiredText(text, description) {
  assert.ok(workflow.includes(text), `${description}: ${text}`);
}

function matchesRequiredPattern(pattern, description) {
  assert.match(workflow, pattern, description);
}

includesRequiredText("name: Production DB Migration", "workflow 名が違います");
matchesRequiredPattern(
  /on:\n\s+push:\n\s+branches:\n\s+- main/,
  "main push 限定のトリガーが必要です"
);
includesRequiredText("workflow_dispatch:", "手動再実行トリガーが必要です");
includesRequiredText(
  "app/prisma/migrations/**",
  "migration 変更で起動する必要があります"
);
includesRequiredText("app/prisma/schema.prisma", "schema 変更で起動する必要があります");
includesRequiredText("app/prisma.config.ts", "Prisma 設定変更で起動する必要があります");
includesRequiredText("group: production-db-migration", "同時実行制限が必要です");
includesRequiredText(
  "cancel-in-progress: false",
  "本番 migration の途中キャンセルは禁止です"
);
includesRequiredText(
  "DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}",
  "本番 DATABASE_URL Secret のマッピングが必要です"
);
includesRequiredText(
  "DIRECT_URL: ${{ secrets.PRODUCTION_DIRECT_URL }}",
  "本番 DIRECT_URL Secret のマッピングが必要です"
);
includesRequiredText(
  "working-directory: app",
  "Prisma コマンドは app で実行する必要があります"
);
includesRequiredText("npm ci", "lockfile に基づく依存関係インストールが必要です");
includesRequiredText(
  "npx prisma migrate deploy",
  "本番 migration は deploy を使う必要があります"
);

assert.ok(
  !workflow.includes("prisma migrate dev"),
  "本番 workflow で prisma migrate dev を使ってはいけません"
);
assert.ok(
  !workflow.includes(".env.local"),
  "本番 workflow で .env.local を参照してはいけません"
);

console.log("Production DB migration workflow verification passed.");
