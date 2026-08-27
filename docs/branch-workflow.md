# ブランチ運用ガイド

> 参考: [【Git×Vercel】本番・プレビュー環境の構築ガイド](https://zenn.dev/ykbone/articles/057d600f6bfb30)

## ブランチ構成

| ブランチ | 用途 | Vercelデプロイ先 |
| --- | --- | --- |
| `main` | 本番運用専用。直接pushは禁止 | **Production** |
| `preview` | 既存のプレビュー確認用。標準フローの必須中継地点ではない | **Preview** |
| `develop` | 既存の開発用ブランチ | **Preview** |
| `feature/*` / `codex/*` | 機能開発用。`main` 向けPRを作成 | **Preview** |

## 日常のワークフロー

### 機能開発〜プレビュー確認

```bash
# 1. mainからcodex/*またはfeature/*ブランチを作成
git checkout main
git checkout -b codex/my-feature   # 任意

# 2. コードを変更してcommit
git add .
git commit -m "feat: ○○機能を追加"

# 3. GitHubにpush → Vercelが自動でPreviewデプロイ
git push origin codex/my-feature

# 4. main向けPRを作成 → PRにVercelプレビューURLが表示される
# 5. スマホブラウザでプレビューURLを開いてUIを確認
# 6. GitHub ActionsとCodex Reviewの結果を確認
```

### mainへマージするとき

```bash
# codex/*またはfeature/* → main にマージ（GitHub上でPR）
# mainへのマージは人間が行う → Productionにデプロイ
```

### Codex Cloudで開発する場合

1. Codex Cloudでリポジトリ `seikatu-gakari/volunty` と `main` を選択
2. 設計案と実装計画を承認しながら実装を進める
3. Codex Cloudが `codex/*` ブランチへpushし、main向けPRを作成
4. Vercelがブランチpushを検知してプレビューデプロイ → URLが発行される
5. スマホブラウザでPreview URLを開いてUIを確認
6. GitHub ActionsとCodex Reviewが成功したら、人間がmainへマージ

## Vercelデプロイのトリガー

現在のVercel設定では、`main` はProduction、それ以外のブランチpushはPreviewとしてデプロイされます。

| イベント | デプロイ先 |
| --- | --- |
| `main` へのpush/マージ | Production |
| `preview` / `develop` / `feature/*` / `codex/*` のpush | Preview |

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

### Vercel設定の確認

Vercel → プロジェクト → **Settings → Git** で、feature/codexブランチのpushがPreviewデプロイ対象になっていることを確認する。main/preview以外をスキップするIgnored Build Stepは使用しない。

## 注意事項

- `main` への直接pushは行わない（PRマージのみ）
- 環境変数は [Vercelダッシュボード](https://vercel.com) → Settings → Environment Variables で管理
- 本番とプレビューで同じ環境変数を使わない（将来バックエンド追加時に注意）
- `.env.local` はローカル専用。gitにはコミットしない（`.gitignore` 済み）
