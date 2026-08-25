# ブランチ運用ガイド

> 参考: [【Git×Vercel】本番・プレビュー環境の構築ガイド](https://zenn.dev/ykbone/articles/057d600f6bfb30)

## ブランチ構成

| ブランチ | 用途 | Vercelデプロイ先 |
| --- | --- | --- |
| `main` | 本番運用専用。直接pushは禁止 | **Production** |
| `preview` | 既存のプレビュー確認用。標準フローの必須中継地点ではない | **Preview** |
| `develop` | 既存の開発用ブランチ | **Preview** |
| `feature/*` | 人間が開始する通常の機能開発用。`main` 向けPRを作成 | **Preview** |
| `codex/*` | 人間が明示的に開始する Codex Cloud 手動フロー。`main` 向けPRを作成 | **Preview** |
| `cursor/*` | `agent-ready` から始まる Cursor Cloud Agent 自律フロー。`main` 向け Draft PRを同一sessionで継続 | **Preview** |

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

### Cursor Cloud Agentで開発する場合

`cursor/*` は [Cursor Cloud Agent運用手順](cursor-cloud.md) の security gateを通過し、default branchで`Pull Request CI`のtarget-only契約がlive verification済みで、外部設定もlive verification済みである場合だけ使う。PR #217の移行時には一時的なdual-trigger bridgeを使用したが、現在の永続運用はbase版`pull_request_target`だけである。通常の開始点は人間が要件・受け入れ条件・dependencyを確認したIssueに`agent-ready`を付けることです。

1. Orchestrator が `@cursor` を一度だけ dispatch し、Cursor は `cursor/issue-<number>-<slug>` を作る。
2. Cursor は早期に `main` 向け Draft PRを作り、その同じ session/branch/PRで設計、実装、CI修正、Human Input、Reworkを続ける。
3. current-head の Ready marker、PR非Draft、Pull Request CI成功がそろうと `Human Review` になる。
4. human reviewと必要なreworkの後、人間だけが `main` へ merge する。Cursor、Codex、Orchestratorのいずれもauto-mergeしない。

`codex/*` と `cursor/*` は同じ Issue に並行して自動起動しない。Codex Cloud は人間が開始する手動フォールバックであり、Cursor Cloud Agent は `agent-ready` 専用である。詳細は [Codex Cloud運用手順](codex-cloud.md) と [Cursor Cloud Agent運用手順](cursor-cloud.md) を参照する。

## Vercelデプロイのトリガー

現在のVercel設定では、`main` はProduction、それ以外のブランチpushはPreviewとしてデプロイされます。

| イベント | デプロイ先 |
| --- | --- |
| `main` へのpush/マージ | Production |
| `preview` / `develop` / `feature/*` / `codex/*` / `cursor/*` のpush | Preview |

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

現行の `Production DB Migration` は `main` へのpushとrepository Actions secretを使う。この経路は Cursor App の `workflows: write` に関する有効化停止条件では未適合であり、Cursor の同一repository自律起動を有効化する前に別変更で安全な経路へ移行する。この文書の変更でproduction workflowやsecretを変更しない。

GitHub の `Repository` → `Settings` → `Secrets and variables` → `Actions` に以下を設定してください。

| Secret名                  | 用途                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `PRODUCTION_DATABASE_URL` | 本番アプリ用の PostgreSQL 接続文字列                                 |
| `PRODUCTION_DIRECT_URL`   | Prisma migration 用の Supabase Session Mode Pooler 接続文字列（5432） |

失敗時は GitHub の `Actions` → `Production DB Migration` でログを確認し、Secret や接続先を修正してから `Run workflow` で再実行します。

### Vercel設定の確認

Vercel → プロジェクト → **Settings → Git** で、feature/codex/cursorブランチのpushがPreviewデプロイ対象になっていることを確認する。main/preview以外をスキップするIgnored Build Stepは使用しない。

## 注意事項

- `main` への直接pushは行わない（PRマージのみ）
- 環境変数は [Vercelダッシュボード](https://vercel.com) → Settings → Environment Variables で管理
- 本番とプレビューで同じ環境変数を使わない（将来バックエンド追加時に注意）
- `.env.local` はローカル専用。gitにはコミットしない（`.gitignore` 済み）
- `codex/*` と `cursor/*` のどちらも自動mergeしない。PRの最終mergeは人間がGitHub UIで行う
