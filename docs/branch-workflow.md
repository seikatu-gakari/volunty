# ブランチ運用ガイド

> 参考: [【Git×Vercel】本番・プレビュー環境の構築ガイド](https://zenn.dev/ykbone/articles/057d600f6bfb30)

## ブランチ構成

| ブランチ    | 用途                                     | Vercelデプロイ先       |
| ----------- | ---------------------------------------- | ---------------------- |
| `main`      | 本番運用専用。直接pushは禁止             | **Production**         |
| `preview`   | プレビュー確認用。安定したらmainにマージ | **Preview**            |
| `develop`   | 開発用。必要に応じてpreviewに統合        | なし（デプロイしない） |
| `feature/*` | 機能開発用。PRでpreviewかmainに向ける    | なし（デプロイしない） |

## 日常のワークフロー

### 機能開発〜プレビュー確認

```bash
# 1. developまたはfeature/* ブランチで作業
git checkout develop
git checkout -b feature/my-feature   # 任意

# 2. コードを変更してcommit
git add .
git commit -m "feat: ○○機能を追加"

# 3. GitHubにpush → Vercelが自動でPreviewデプロイ
git push origin feature/my-feature

# 4. GitHub上でPRを作成 → PRにVercelプレビューURLが自動コメントされる
# 5. スマホブラウザでプレビューURLを開いてUIを確認
```

### プレビュー確認OKのとき

```bash
# feature/* → preview → main の順でマージ
# ① feature/* → preview にマージ（GitHub上でPR）
# ② preview → main にマージ（GitHub上でPR） → Productionにデプロイ
```

### スマホからAI（Claude Code Web）で開発する場合

1. [claude.ai/code](https://claude.ai/code) でリポジトリに接続
2. プロンプトで指示（例:「○○画面を実装して、previewブランチにPRを作成して」）
3. Claude Codeが自動でコードを書いてPRを作成
4. VercelがPRを検知してプレビューデプロイ → URLが発行される
5. スマホブラウザでUIを確認
6. OKならGitHub上でPRをマージ

## Vercelデプロイのトリガー

`main` と `preview` ブランチのpushのみデプロイされます。それ以外はスキップ。

| イベント                       | デプロイ先                   |
| ------------------------------ | ---------------------------- |
| `main` へのpush/マージ         | Production                   |
| `preview` へのpush             | Preview                      |
| `develop` / `feature/*` のpush | **スキップ（デプロイなし）** |

## 本番DBマイグレーション

`main` へのマージで Prisma migration 関連ファイルが更新された場合、GitHub Actions の `Production DB Migration` workflow が自動実行されます。

対象ファイル:

- `app/prisma/migrations/**`
- `app/prisma/schema.prisma`
- `app/prisma.config.ts`
- `app/package.json`
- `app/package-lock.json`
- `.github/workflows/production-db-migrate.yml`

workflow は `app/` で `npx prisma migrate deploy` を実行します。未適用 migration がなければ何も適用せず終了し、未適用 migration があれば本番DBへ適用します。手元の `app/.env.local` を本番用に書き換えて migration する運用は行いません。

GitHub の `Repository` → `Settings` → `Secrets and variables` → `Actions` に以下を設定してください。

| Secret名                  | 用途                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `PRODUCTION_DATABASE_URL` | 本番アプリ用の PostgreSQL 接続文字列                                 |
| `PRODUCTION_DIRECT_URL`   | Prisma migration 用の Supabase Session Mode Pooler 接続文字列（5432） |

失敗時は GitHub の `Actions` → `Production DB Migration` でログを確認し、Secret や接続先を修正してから `Run workflow` で再実行します。

### ブランチ制限の設定（初回のみ・Vercelダッシュボード）

Vercel → プロジェクト → **Settings → Git → Ignored Build Step** に以下を入力して保存：

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ] || [ "$VERCEL_GIT_COMMIT_REF" = "preview" ]; then exit 1; else exit 0; fi
```

> `exit 0` = ビルドをスキップ、`exit 1` = ビルドを実行（Vercelの仕様）

## 注意事項

- `main` への直接pushは行わない（PRマージのみ）
- 環境変数は [Vercelダッシュボード](https://vercel.com) → Settings → Environment Variables で管理
- 本番とプレビューで同じ環境変数を使わない（将来バックエンド追加時に注意）
- `.env.local` はローカル専用。gitにはコミットしない（`.gitignore` 済み）
