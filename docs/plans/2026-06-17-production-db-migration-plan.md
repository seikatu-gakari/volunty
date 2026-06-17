# Production DB Migration Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` へのマージ後に本番 Prisma migration を GitHub Actions で自動適用する。

**Architecture:** GitHub Actions workflow を追加し、`main` の migration 関連変更で `cd app && npx prisma migrate deploy` を実行する。接続情報は `.env.local` ではなく GitHub Actions Secrets から `DATABASE_URL` と `DIRECT_URL` にマッピングする。

**Tech Stack:** GitHub Actions, Node.js, npm, Prisma 7, Supabase PostgreSQL

---

### Task 1: Workflow 構造検証

**Files:**
- Create: `scripts/verify-production-db-migration-workflow.mjs`
- Create: `.github/workflows/production-db-migrate.yml`
- Modify: `docs/branch-workflow.md`

- [ ] **Step 1: Write the failing test**

```bash
node scripts/verify-production-db-migration-workflow.mjs
```

Expected: `.github/workflows/production-db-migrate.yml` が存在しないため失敗する。

- [ ] **Step 2: Add the production migration workflow**

```yaml
name: Production DB Migration
on:
  push:
    branches:
      - main
    paths:
      - "app/prisma/migrations/**"
      - "app/prisma/schema.prisma"
      - "app/prisma.config.ts"
      - "app/package.json"
      - "app/package-lock.json"
      - ".github/workflows/production-db-migrate.yml"
  workflow_dispatch:
```

Secrets は `PRODUCTION_DATABASE_URL` と `PRODUCTION_DIRECT_URL` を設定し、job 内で `DATABASE_URL` と `DIRECT_URL` にマッピングする。

- [ ] **Step 3: Document required secrets and operation**

`docs/branch-workflow.md` に GitHub Actions の場所、必要な Secret、失敗時の再実行方法を追記する。

- [ ] **Step 4: Verify the workflow**

```bash
node scripts/verify-production-db-migration-workflow.mjs
```

Expected: `Production DB migration workflow verification passed.`

- [ ] **Step 5: Check repository diff**

```bash
git diff -- .github/workflows/production-db-migrate.yml docs/branch-workflow.md scripts/verify-production-db-migration-workflow.mjs docs/plans/2026-06-17-production-db-migration-plan.md
```

Expected: workflow, docs, and verification script changes are scoped to production migration automation.
