# Volunty

BIG5性格診断に基づくボランティアマッチングWebアプリケーション。

## 必要な環境

- Node.js 20+
- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

```bash
# Supabase CLI のインストール（Homebrew）
brew install supabase/tap/supabase
```

---

## ローカル環境構築

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone https://github.com/seikatu-gakari/volunty.git
cd volunty
make install
```

### 2. 環境変数の設定

このプロジェクトのローカル環境変数は `.env.local` に統一しています。

| ファイル             | 読む主体                                             | 用途                                 |
| -------------------- | ---------------------------------------------------- | ------------------------------------ |
| `.env.local`         | Next.js / Prisma CLI / Supabase CLI / 補助スクリプト | ローカル開発で使う接続情報と秘密情報 |
| `.env.local.example` | セットアップ用テンプレート                           | 初期作成用の雛形                     |

```bash
# ローカル開発用の設定を作成
cp app/.env.local.example app/.env.local
```

`.env.local` を編集し、Supabase の接続情報を設定します。値は後述の「ローカルDB構築」後に `make supabase-status` で確認してください。

### 3. 開発サーバーの起動

```bash
# Docker で起動（推奨）
make up

# または、ホストマシンで直接起動
cd app && npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

---

## ローカルDB構築

Supabase をローカルで起動し、マイグレーション（テーブル作成）とテストデータを自動投入します。

### 1. Supabase の起動

```bash
make supabase-start
```

初回起動時は以下が自動適用されます。

- `supabase/migrations/` — テーブル作成マイグレーション
- `supabase/seed.sql` — RLSポリシー + テストデータ

### 2. `.env.local` に接続情報を設定

起動後に表示される値（または `make supabase-status` で確認）を設定してください。

```bash
# app/.env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Publishable key>

# Docker を使わずホストマシンで npm run dev する場合は不要。
# Docker Compose 利用時は docker-compose.yml 側で設定済み。
# SUPABASE_INTERNAL_URL=http://host.docker.internal:54321

# Prisma 接続用
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 3. Google OAuth のローカル設定

ローカル Supabase Auth で Google ログインを使うには、Google Cloud の OAuth クライアント情報を `.env.local` に設定してください。

```bash
# app/.env.local
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<Google OAuth クライアント ID>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<Google OAuth クライアント シークレット>
```

Google Cloud の「承認済みのリダイレクト URI」には、少なくとも次を登録します。

- `http://127.0.0.1:54321/auth/v1/callback`

設定後、ローカル Supabase を再起動してください。

```bash
make supabase-clean
make supabase-start
```

`Unsupported provider: provider is not enabled` が出る場合は、`.env.local` の Google OAuth 環境変数を設定したうえで Supabase を再起動してください。

### 4. テーブル・データの確認

**Supabase Studio（GUI）**

```
http://127.0.0.1:54323
```

**psql（CLI）**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### テストユーザー一覧

| メールアドレス         | パスワード  | ロール       | 備考                  |
| ---------------------- | ----------- | ------------ | --------------------- |
| tanaka@example.com     | password123 | participant  | 診断済み・応募済み    |
| sato@example.com       | password123 | participant  | 診断済み・承認済み    |
| suzuki@example.com     | password123 | participant  | 未診断                |
| greenearth@example.com | password123 | organization | NPO法人グリーンアース |
| mirai@example.com      | password123 | organization | NPO法人みらい学舎     |

---

## よく使うコマンド

```bash
# 開発
make up              # Docker で開発サーバー起動
make down            # 停止
make logs            # ログ確認
make lint            # ESLint 実行

# DB 操作
make supabase-start   # Supabase 起動（初回: マイグレーション + seed 自動適用）
make supabase-stop    # Supabase 停止（データ保持）
make supabase-reset   # DB リセット（マイグレーション再適用 + seed）
make supabase-clean   # Supabase 停止 + データ完全削除
make supabase-status  # 接続情報の確認

# テスト
cd app && npm run test
```

---

## ドキュメント

- [アーキテクチャ概要](../docs/architecture/overview.md)
- [要件定義](../docs/requirements/requirements-definition.md)
- [DB設計](../docs/design/database-design.md)
- [BIG5診断設計](../docs/design/personality-diagnosis-big5.md)
