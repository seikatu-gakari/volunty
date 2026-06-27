# E2E 認証バイパス基盤 — 実装仕様

> **目的**: Playwright MCP（および将来の CI 自動スイート）が Google OAuth を経由せずに Supabase セッションを取得し、認証後フローを自動操作できるようにする。
> **対象環境**: ローカル Supabase のみ（本番・Vercel Preview への影響ゼロを保証する）。

---

## 背景と制約

- ログインは **Google OAuth のみ** (`supabase.auth.signInWithOAuth({provider:"google"})`)。`prompt: "select_account"` が強制されているため Playwright による自動操作は不可。
- Supabase の `config.toml` では `[auth.email] enable_signup = true` が設定済み（バックエンドでメール認証は有効）。UI には出していないだけ。
- Cookie 名: `sb-volunty-auth-token`（`SUPABASE_AUTH_COOKIE_NAME`）。`@supabase/ssr` が内部でチャンク分割・Base64 エンコードして複数の Cookie に分解するため、外部から Cookie を直注入すると壊れやすい。
- **解決策**: `signInWithPassword` を使いサーバー側 Supabase クライアント経由でセッションを確立する。Cookie エンコードはライブラリに委ねる。

---

## 設計方針

```
[Playwright MCP]
  browser_navigate("http://localhost:3000/api/test-auth/login?persona=participant-onboarded")
        │
        ▼ GET /api/test-auth/login (Next.js Route Handler)
        │   ① 二重ガード (NODE_ENV / E2E_AUTH_ENABLED)
        │   ② persona → email/password を解決
        │   ③ createClient().auth.signInWithPassword(...)
        │   ④ ensureUserRecord(user, { role })  ← 本番 callback と同じ処理
        │   ⑤ Response に sb-volunty-auth-token Cookie をセット
        ▼
  redirect → next (デフォルト "/")
        ▼
[Playwright MCP] 認証済み状態で本来の E2E フローを操作
```

---

## セキュリティ要件（最重要）

| ガード | 条件 | 破られた場合の影響 |
|--------|------|--------------------|
| `NODE_ENV === "production"` なら 404 | Vercel 本番は常に `production` | バイパスルートが本番に到達しない |
| `E2E_AUTH_ENABLED !== "true"` なら 404 | `.env.local` にのみ設定。Vercel 環境変数には追加しない | Preview 環境でもデフォルト無効 |
| persona 解決は server-only モジュール | クライアントバンドルに credentials が漏れない | — |
| パスワードは env 変数（`E2E_TEST_USER_PASSWORD`）から取得 | ハードコードなし | — |
| `next` パラメータは内部パス（`/` 始まり）のみ許可 | オープンリダイレクト防止 | — |

---

## 実装対象ファイル一覧

### 新規作成

```
app/src/app/api/test-auth/login/route.ts      # テスト専用 GET ルート
app/src/lib/test-auth/personas.ts             # persona 定義（server-only）
app/src/lib/test-auth/personas.test.ts        # persona 解決のユニットテスト
app/src/app/api/test-auth/login/route.test.ts # ガードのユニットテスト
scripts/seed-e2e.ts                           # テストユーザー seed スクリプト
```

### 変更なし

既存の `createClient()`、`createAdminClient()`、`ensureUserRecord()` はそのまま利用する。

---

## 各ファイルの実装詳細

### 1. `app/src/lib/test-auth/personas.ts`

```typescript
// server-only — クライアントバンドルに含まれない
import "server-only";

export type PersonaKey =
  | "participant-fresh"
  | "participant-onboarded"
  | "organization-approved"
  | "admin";

export interface Persona {
  key: PersonaKey;
  email: string;
  /** role は ensureUserRecord に渡す。auth.users の role とは別 */
  role: "participant" | "organization" | "admin";
  description: string;
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  "participant-fresh": {
    key: "participant-fresh",
    email: "e2e-participant-fresh@example.com",
    role: "participant",
    description: "auth のみ／オンボーディング未完了（新規登録直後を再現）",
  },
  "participant-onboarded": {
    key: "participant-onboarded",
    email: "e2e-participant-onboarded@example.com",
    role: "participant",
    description: "プロフィール＋診断済み参加者",
  },
  "organization-approved": {
    key: "organization-approved",
    email: "e2e-org-approved@example.com",
    role: "organization",
    description: "承認済み団体ユーザー",
  },
  admin: {
    key: "admin",
    email: "e2e-admin@example.com",
    role: "admin",
    description: "管理者ロール",
  },
};

export function resolvePersona(key: string): Persona | null {
  return (PERSONAS as Record<string, Persona>)[key] ?? null;
}
```

---

### 2. `app/src/app/api/test-auth/login/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserRecord } from "@/lib/auth/ensure-user-record";
import { resolvePersona } from "@/lib/test-auth/personas";
import type { UserRole } from "@/generated/prisma/client";

function isTestAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_AUTH_ENABLED === "true"
  );
}

function getSafeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export async function GET(request: Request) {
  // 二重ガード
  if (!isTestAuthEnabled()) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const personaKey = url.searchParams.get("persona");
  const next = getSafeNext(url.searchParams.get("next"));

  if (!personaKey) {
    return NextResponse.json(
      { error: "persona パラメータが必要です" },
      { status: 400 }
    );
  }

  const persona = resolvePersona(personaKey);
  if (!persona) {
    return NextResponse.json(
      { error: `不明な persona: ${personaKey}` },
      { status: 400 }
    );
  }

  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password) {
    console.error("[TestAuth] E2E_TEST_USER_PASSWORD が未設定です");
    return NextResponse.json(
      { error: "サーバー設定エラー" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: persona.email,
    password,
  });

  if (error || !data.user) {
    console.error("[TestAuth] signInWithPassword 失敗:", error);
    return NextResponse.json(
      { error: "認証失敗", detail: error?.message },
      { status: 401 }
    );
  }

  try {
    await ensureUserRecord(data.user, { role: persona.role as UserRole });
  } catch (err) {
    console.error("[TestAuth] ensureUserRecord 失敗:", err);
    return NextResponse.json(
      { error: "ユーザーレコード同期失敗" },
      { status: 500 }
    );
  }

  // createClient() がセッションを Cookie に書き込み済みなので redirect のみ
  const redirectUrl = new URL(next, url.origin).toString();
  return NextResponse.redirect(redirectUrl, { status: 302 });
}
```

> **注意**: `createClient()` は `cookies()` ストアを介してレスポンスに Cookie を書き込む。Next.js の Route Handler では Server Actions と同じ仕組みが動くため、`setAll` が正しく呼ばれる。

---

### 3. `scripts/seed-e2e.ts`

> **役割**: ローカル Supabase に E2E テストユーザーを冪等に投入する。CI / ローカル両対応。

```typescript
#!/usr/bin/env tsx
/**
 * E2E テストユーザーの seed スクリプト。
 * ローカル Supabase (port 54321) + Prisma に対して実行する。
 * 実行: npm run seed:e2e (app/ ディレクトリから)
 */
import { PrismaClient } from "@/generated/prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERSONAS } from "@/lib/test-auth/personas";

const prisma = new PrismaClient();

async function main() {
  const supabase = createAdminClient();
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password) {
    throw new Error("E2E_TEST_USER_PASSWORD が未設定です");
  }

  for (const persona of Object.values(PERSONAS)) {
    // auth.users に冪等作成
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users.find((u) => u.email === persona.email);

    let userId: string;
    if (existing) {
      // パスワードを最新の値に更新（冪等）
      await supabase.auth.admin.updateUserById(existing.id, { password });
      userId = existing.id;
      console.log(`[seed] 更新: ${persona.email} (${persona.key})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: persona.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `E2E ${persona.key}` },
      });
      if (error || !data.user) {
        throw new Error(`[seed] 作成失敗 ${persona.email}: ${error?.message}`);
      }
      userId = data.user.id;
      console.log(`[seed] 作成: ${persona.email} (${persona.key})`);
    }

    // m_user を Prisma で upsert
    await prisma.user.upsert({
      where: { id: userId },
      update: { role: persona.role, email: persona.email },
      create: {
        id: userId,
        email: persona.email,
        name: `E2E ${persona.key}`,
        role: persona.role,
      },
    });
  }

  // persona 別の追加状態セットアップ
  // ── participant-onboarded: ParticipantProfile を作成（存在する場合はスキップ）
  // ── organization-approved: OrganizationProfile + review_status = approved
  // ── これらは seed-e2e.ts を直接拡張する（同じファイル内に setupParticipant(), setupOrganization() として追加）
  // ── Phase 1 では auth 認証の疎通のみ確認。プロフィール等は手動 or 追加 seed で対応。

  console.log("[seed] E2E ユーザーの seed 完了");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

---

### 4. `package.json` への追加（`app/package.json`）

```json
"scripts": {
  "seed:e2e": "tsx -r tsconfig-paths/register scripts/seed-e2e.ts"
}
```

> `tsx` と `tsconfig-paths` はすでに開発依存に含まれているか確認し、なければ追加する。

---

### 5. `.env.local` への追加（コミットしない）

```dotenv
# E2E テスト専用（本番 Vercel の環境変数には絶対に設定しない）
E2E_AUTH_ENABLED=true
E2E_TEST_USER_PASSWORD=<ローカルのみで使うランダムパスワード>
```

---

### 6. ユニットテスト: `app/src/lib/test-auth/personas.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { resolvePersona, PERSONAS } from "./personas";

describe("resolvePersona", () => {
  it("有効な persona キーを解決できる", () => {
    for (const key of Object.keys(PERSONAS)) {
      expect(resolvePersona(key)).not.toBeNull();
    }
  });

  it("不明なキーは null を返す", () => {
    expect(resolvePersona("unknown-key")).toBeNull();
    expect(resolvePersona("")).toBeNull();
  });
});
```

---

### 7. ユニットテスト: `app/src/app/api/test-auth/login/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// isTestAuthEnabled のガードテスト（環境変数モック）
describe("GET /api/test-auth/login — ガード", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("NODE_ENV=production のとき 404 を返す", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_AUTH_ENABLED", "true");
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/test-auth/login?persona=admin");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("E2E_AUTH_ENABLED 未設定のとき 404 を返す", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_AUTH_ENABLED", "");
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/test-auth/login?persona=admin");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("persona 未指定のとき 400 を返す", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_AUTH_ENABLED", "true");
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "testpass");
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/test-auth/login");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("不明な persona のとき 400 を返す", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_AUTH_ENABLED", "true");
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "testpass");
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/test-auth/login?persona=unknown");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
```

> `createClient` と `ensureUserRecord` は Supabase 接続を必要とするため、統合テストは MCP 手動疎通で代替する（Phase 1）。

---

## ローカルでの実行手順（Codex / 実装者向け）

```bash
# 1. ローカル Supabase を起動
supabase start

# 2. E2E テストユーザーを seed（app/ 配下で実行）
cd app
E2E_TEST_USER_PASSWORD=<任意パスワード> npm run seed:e2e

# 3. .env.local に以下を追加（既存キーと並べる）
#    E2E_AUTH_ENABLED=true
#    E2E_TEST_USER_PASSWORD=<上記と同じパスワード>

# 4. Next.js 開発サーバーを起動
npm run dev
```

**MCP での疎通確認（Playwright MCP）**:

```
browser_navigate("http://localhost:3000/api/test-auth/login?persona=participant-onboarded")
```

→ リダイレクト後に `http://localhost:3000/` が認証済み状態で開けば成功。

```
browser_navigate("http://localhost:3000/api/test-auth/login?persona=admin&next=/admin/users")
```

→ 管理者として `/admin/users` に直接遷移する例。

---

## ペルソナ一覧（Phase 1）

| キー | メール | ロール | 状態 |
|------|--------|--------|------|
| `participant-fresh` | e2e-participant-fresh@example.com | participant | auth のみ・プロフィール未登録 |
| `participant-onboarded` | e2e-participant-onboarded@example.com | participant | プロフィール＋診断済み（seed で別途設定） |
| `organization-approved` | e2e-org-approved@example.com | organization | 承認済み団体（seed で別途設定） |
| `admin` | e2e-admin@example.com | admin | 管理者ロール |

> `docs/quality/e2e-test-cases.md` の6ペルソナ（参加者B・団体B・凍結ユーザー等）は、同じ `PERSONAS` に追加するだけで対応できる。

---

## 将来拡張（本仕様のスコープ外）

- `@playwright/test` 導入 + `globalSetup` で上記ルートを叩き、ペルソナ別の `storageState.json` を生成 → CI で自動 e2e スイート化
- `participant-onboarded` と `organization-approved` のプロフィール seed を `scripts/seed-e2e.ts` に追加（`setupParticipant()` / `setupOrganization()` 関数として実装）
- Preview 環境対応（`E2E_AUTH_ENABLED` を Vercel の Preview 専用環境変数として限定的に有効化する場合は、別途セキュリティレビューを行う）

---

## チェックリスト（Codex 実装完了条件）

- [ ] `app/src/lib/test-auth/personas.ts` 作成
- [ ] `app/src/app/api/test-auth/login/route.ts` 作成
- [ ] `scripts/seed-e2e.ts` 作成
- [ ] `app/package.json` に `seed:e2e` スクリプト追加
- [ ] `tsx` / `tsconfig-paths` が devDependencies にあるか確認（なければ追加）
- [ ] `app/src/lib/test-auth/personas.test.ts` 作成
- [ ] `app/src/app/api/test-auth/login/route.test.ts` 作成
- [ ] `vitest run` でユニットテストがパス
- [ ] `supabase start` + `npm run seed:e2e` でユーザーが作成される
- [ ] MCP で `browser_navigate` → `/` が認証済みで開く（疎通確認）
- [ ] `NODE_ENV=production` 時に 404 が返ることをテストで確認済み
