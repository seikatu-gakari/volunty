# Volunty Codex Cloud 運用手順

## 標準フロー

Codex Cloud は設計、実装、検証、Pull Request 作成までを担当する。`main` へのマージは人間が行う。

1. Codex Cloudで `seikatu-gakari/volunty` と `main` を対象にタスクを開始する。
2. Codexが関連コードと設計書を調査し、設計案を提示する。
3. 人間が設計案を承認する。
4. Codexが実装計画を提示する。
5. 人間が実装計画を承認する。
6. Codexが `codex/<topic>` ブランチで実装し、lint、UT、buildを実行する。
7. ブランチpushでVercel Previewが自動デプロイされる。
8. Codexが `main` 向けPull Requestを作成する。
9. GitHub Actionsのquality/e2e、Codex Review、Vercel Previewを確認する。
10. 失敗があればCodexに同じPRブランチの修正を依頼する。
11. 全チェック成功後、人間が `main` にマージする。

## Codex Cloud Environment

Codex設定画面で `seikatu-gakari/volunty` 用Environmentを作成し、次を登録する。

| 項目 | 設定 |
| --- | --- |
| Runtime | Node.js 22（22.12以上） |
| Setup | `bash .codex/cloud/setup.sh` |
| Maintenance | `bash .codex/cloud/maintenance.sh` |
| `TZ` | `Asia/Tokyo`（`datetime-local` の解釈をCIと揃える） |
| Agent internet access | 原則off。必要時だけ信頼できる依存関係ドメインのGET/HEAD/OPTIONS |

Setupは `npm ci --no-audit` と `npm run db:generate`だけを実行する。Docker、Supabase local、開発サーバー、本番migrationは起動しない。

### 環境変数とSecret

Cloudへ登録するのは、アプリのビルドや静的な検証に必要な非秘密値だけとする。

次の値はCloudへ登録しない。

- 本番 `DATABASE_URL`、`DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Google OAuth secret
- Vercel token
- 本番・Preview環境の管理用token

E2EはGitHub Actions上の一時Supabaseを使う。E2E用のservice role keyはActions runner内でSupabase CLIから取得し、ジョブ終了時に破棄する。

## GitHub設定

### Pull Request CI

`.github/workflows/ci.yml` は `main` 向けPull Requestで次を実行する。

- `quality`: npm install、Prisma生成、lint、UT、`npm run build -- --webpack`
- `e2e`: Supabase CLIでlocal環境を起動、migration適用、Playwright E2E、結果artifact保存、Supabase停止

`quality` のbuildは実サービスへ接続しないplaceholder環境変数をjob限定で使う。`e2e` はSupabase CLIが発行する一時環境変数を `.env.local` に設定する。

`quality` と `e2e` を `main` のrequired checksに登録する。

### main branch protection

GitHubの `Settings → Branches` で `main` に次を設定する。

- Pull Request経由の変更を必須にする
- `quality` と `e2e` をrequired checksにする
- 必須reviewを設定する
- 未解決reviewがある場合はマージ不可にする
- force pushとbranch deletionを禁止する
- 自動マージを有効にしない

Codex Cloudには `main` への直接push・マージ権限を与えない。

### Codex Code Review

Codex設定で対象リポジトリのCode ReviewとAutomatic reviewsを有効にする。レビューはCIや人間の承認の代替ではないため、重大な指摘、CI結果、Previewをすべて確認する。

## Vercel Preview

現在のVercel設定では、`main` はProduction、それ以外のブランチpushはPreviewデプロイになる。

Codex Cloudのブランチpush後、PR画面またはVercel dashboardからPreview URLを確認する。VercelのIgnored Build Stepで `codex/*` を除外しない。

## Cloudへの依頼テンプレート

```text
Issue #123を対応してください。
まず関連コードと設計書を調査し、設計案を提示してください。
設計承認までは実装しないでください。
設計承認後に実装計画を提示し、計画承認後に実装してください。
作業ブランチは codex/cloud-setup とし、必要なUT/E2Eを追加・実行してください。
lint、UT、build、E2E、Vercel Preview、Codex Reviewを確認したうえでmain向けPRを作成してください。
mainへのマージは行わないでください。
```

## 失敗時の対応

- Setup失敗: Node.jsが22.12以上か、`app/package-lock.json`が存在するかを確認し、必要ならCloud EnvironmentのcacheをResetする。
- Quality失敗: Cloudの同じタスクで修正し、lint、UT、buildを再実行する。
- E2E失敗: GitHub ActionsのPlaywright artifact、trace、screenshotを確認し、同じPRブランチへ修正を依頼する。
- Preview失敗: Vercelのbuild logと環境変数設定を確認する。本番値をCloudへコピーしない。
- PR作成失敗: GitHub接続、repository write権限、main branch protectionを確認する。mainの保護を解除して回避しない。

## 関連ファイル

- [Codex Cloud setup](../.codex/cloud/setup.sh)
- [Codex Cloud maintenance](../.codex/cloud/maintenance.sh)
- [Pull Request CI](../.github/workflows/ci.yml)
- [ブランチ運用](branch-workflow.md)
- [Codex Cloud設計書](superpowers/specs/2026-08-01-codex-cloud-development-design.md)
