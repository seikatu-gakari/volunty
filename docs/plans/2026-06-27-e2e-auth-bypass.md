# E2E 認証バイパス基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ローカル環境に限り、E2E クライアントが Google OAuth を介さずペルソナ別 Supabase セッションを取得できるようにする。

**Architecture:** server-only のペルソナ定義を Route Handler と seed スクリプトで共有する。Route Handler は `NODE_ENV` と `E2E_AUTH_ENABLED` の二重ガード後に `signInWithPassword` と既存の `ensureUserRecord` を呼び、`@supabase/ssr` に Cookie 書き込みを委ねる。

**Tech Stack:** Next.js 16 App Router、TypeScript 5 strict、Supabase Auth、Prisma 7、Vitest 2、tsx

## Global Constraints

- `NODE_ENV === "production"` の場合は常に 404 を返す。
- `E2E_AUTH_ENABLED !== "true"` の場合は常に 404 を返す。
- ペルソナと認証情報はクライアントバンドルへ含めない。
- パスワードは `E2E_TEST_USER_PASSWORD` からのみ取得する。
- `next` は `/` で始まり `//` で始まらない内部パスだけを許可する。
- 既存の `createClient()`、`createAdminClient()`、`ensureUserRecord()` は変更しない。

---

### Task 1: ペルソナ定義と解決

**Files:**
- Create: `app/src/lib/test-auth/personas.ts`
- Test: `app/src/lib/test-auth/personas.test.ts`

**Interfaces:**
- Produces: `PersonaKey`、`Persona`、`PERSONAS`、`resolvePersona(key: string): Persona | null`

- [x] **Step 1: 解決成功・不明キーの失敗テストを書く**
- [x] **Step 2: `cd app && npx vitest run src/lib/test-auth/personas.test.ts` を実行し、モジュール未存在で失敗することを確認する**
- [x] **Step 3: `import "server-only"` を含む4ペルソナの定義と型安全な `resolvePersona` を実装する**
- [x] **Step 4: 同じテストを再実行し、全件成功を確認する**

### Task 2: テスト専用ログイン Route Handler

**Files:**
- Create: `app/src/app/api/test-auth/login/route.ts`
- Test: `app/src/app/api/test-auth/login/route.test.ts`

**Interfaces:**
- Consumes: `resolvePersona(key: string): Persona | null`、`createClient()`、`ensureUserRecord(user, { role })`
- Produces: `GET(request: Request): Promise<NextResponse>`

- [x] **Step 1: Supabase とユーザー同期を mock し、二重ガード、入力検証、パスワード未設定、認証失敗、同期失敗、安全なリダイレクト、成功時の呼び出しを検証するテストを書く**
- [x] **Step 2: `cd app && npx vitest run src/app/api/test-auth/login/route.test.ts` を実行し、モジュール未存在で失敗することを確認する**
- [x] **Step 3: ガード、ペルソナ解決、`signInWithPassword`、`ensureUserRecord`、302 リダイレクトだけを実装する**
- [x] **Step 4: 同じテストを再実行し、全件成功を確認する**

### Task 3: 冪等 seed コマンド

**Files:**
- Create: `app/scripts/seed-e2e.ts`
- Modify: `app/package.json`
- Modify: `app/package-lock.json`

**Interfaces:**
- Consumes: `createAdminClient()`、`PERSONAS`、`PrismaClient`
- Produces: `npm run seed:e2e`

- [x] **Step 1: `seed:e2e` 未定義と `tsconfig-paths` 未宣言を確認する**
- [x] **Step 2: auth.users の検索・作成またはパスワード更新と、m_user の upsert を行う `app/scripts/seed-e2e.ts` を実装する**
- [x] **Step 3: `seed:e2e` スクリプトと `tsconfig-paths` devDependency を追加する**
- [x] **Step 4: `cd app && npx tsc --noEmit` で seed を含む型チェック成功を確認する**

### Task 4: 総合検証

**Files:**
- Verify: 上記の新規・変更ファイル

**Interfaces:**
- Consumes: Task 1〜3 の成果物
- Produces: ローカル限定 E2E 認証バイパス基盤

- [x] **Step 1: `cd app && npm test` を実行する**
- [x] **Step 2: `cd app && npm run lint` を実行する**
- [x] **Step 3: `cd app && npx tsc --noEmit` を実行する**
- [x] **Step 4: `cd app && npm run build` を実行する**
- [x] **Step 5: ローカル Supabase が利用可能なら `npm run seed:e2e` とブラウザ疎通を確認する**
- [x] **Step 6: `git diff --check` と差分レビューを行う**
