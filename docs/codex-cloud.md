# Volunty Codex Cloud 運用手順

## 標準フロー

Codex Cloud は設計、実装、検証、Pull Request 作成までを担当する。`main` へのマージは人間が行う。

1. Codex Cloudで `seikatu-gakari/volunty` と `main` を対象にタスクを開始する。
2. 設計が未承認の場合、Codexが必要な関連コード・設計書を調査し、設計案を提示する。
3. 人間が設計案を承認する。
4. Codexが実装計画を提示する。
5. 人間が実装計画を承認する。
6. Codexが `codex/<topic>` ブランチで実装し、変更に必要な検証を実行する。会話やIssueで設計・計画が承認済みなら、承認内容を引き継いでこの段階から進める。
7. ブランチpushでVercel Previewが自動デプロイされる。
8. Codexが `main` 向けPull Requestを作成する。
9. GitHub Actionsのquality/e2e、Codex Review、Vercel Previewを確認する。
10. Codexが変更に起因する失敗を同じPRブランチで修正し、影響する検証を再実行する。追加権限や設計拡張が必要な場合は確認する。
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

SetupとMaintenanceは固定バージョンのContext7 CLIとVercel CLIの導入、`npm ci --no-audit`、`npm run db:generate`だけを実行する。Docker、Supabase local、開発サーバー、本番migrationは起動しない。

### CLI優先のツール構成

ローカル環境では `.codex/config.toml` のネイティブMCP設定を維持する。Codex Cloudでは `mcpc` やネイティブMCPへ依存せず、次のCLIを直接使用する。

| 用途 | Codex Cloudで使用するCLI・方法 |
| --- | --- |
| ドキュメント検索 | `ctx7 library` / `ctx7 docs` |
| ブラウザ・E2E | `cd app && npx playwright` |
| DB・Prisma | `cd app && npx prisma` |
| UT | `cd app && npx vitest` |
| lint | `cd app && npx eslint` |
| 型チェック | `cd app && npx tsc` |
| Vercel | `vercel` CLI |
| コード検索 | `rg` / `git grep` |
| GitHub操作・PR作成 | Codex Cloud標準のGitHub接続 |
| Previewデプロイ | featureブランチへのpush |

Context7はsetup/maintenanceで公式 `ctx7@0.5.7` CLIを導入する。Vercel CLIは `vercel@58.7.1` に固定する。

```bash
ctx7 library next.js 'App Routerのキャッシュ仕様'
ctx7 docs /vercel/next.js 'App Routerのキャッシュ仕様'
```

Serena相当のコード調査は `rg`、`git grep`、TypeScript、既存テストで行う。Figma LocalはCloudコンテナから利用できないため使用しない。Context7を使う場合は、Agent internet accessで `context7.com` へのGET/HEAD/OPTIONSだけを許可する。

### Vercel CLI

SetupとMaintenanceは `vercel@58.7.1` を導入し、`vercel --version` でインストール結果を検証する。

Vercel tokenや本番資格情報はCloudへ登録しないため、`vercel deploy`、`vercel env`、`vercel logs`などのアカウント認証を必要とする操作は行わない。Previewデプロイは従来どおりfeatureブランチへのpushで自動実行する。`.vercel/` はローカル生成物として追跡しない。

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
- `e2e`: Supabase CLIでlocal環境を起動、DB reset（migration + seed）、Playwright E2E、結果artifact保存、Supabase停止

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

設計から相談する場合:

```text
Issue #123の関連コードと設計を必要な範囲で調査し、設計案と実装計画を提示してください。
今回は調査・提案までとし、ファイルの作成・編集やGitHubへの書き込みは行わないでください。
```

承認済みの内容を実装する場合:

```text
Issue #123を、この会話で承認した設計・実装計画に従ってReady PRまで進めてください。
既存変更を保護し、codex/<topic>ブランチで実装してください。
必要な既存テストを実行し、カバレッジが不足するケースだけ追加・更新してください。
実装後は作業ブランチへpushし、main向けPRを作成してください。
PR作成後の最新HEADについてCI、Vercel Preview、Codex Reviewと指摘対応を確認し、
変更に起因する失敗の修正・再検証まで続けてください。
このPRへの @codex review 依頼は1回まで許可します。既存の依頼があれば再利用してください。
追加権限・本番操作・承認済み設計の拡張が必要なときに確認し、mainにはマージしないでください。
```

完了条件は実装・必要な検証・PR作成・作成後の各ゲート成功まで。CIでのみ実行できるE2Eはその結果で確認し、待機中・未実行・失敗を完了と扱わない。第三者への完了通知が必要な場合は、宛先と通知内容を依頼に追加する。

## 失敗時の対応

- Setup失敗: Node.jsが22.12以上か、`app/package-lock.json`が存在するかを確認し、必要ならCloud EnvironmentのcacheをResetする。
- Quality失敗: Cloudの同じタスクで原因を修正し、影響する検証を再実行する。
- E2E失敗: GitHub ActionsのPlaywright artifact、trace、screenshotを確認し、変更に起因する失敗を同じPRブランチで修正する。
- Preview失敗: Vercelのbuild logと環境変数設定を確認する。本番値をCloudへコピーしない。
- PR作成失敗: GitHub接続、repository write権限、main branch protectionを確認する。mainの保護を解除して回避しない。

## 関連ファイル

- [Codex Cloud setup](../.codex/cloud/setup.sh)
- [Codex Cloud maintenance](../.codex/cloud/maintenance.sh)
- [Pull Request CI](../.github/workflows/ci.yml)
- [ブランチ運用](branch-workflow.md)
- [Codex Cloud設計書](superpowers/specs/2026-08-01-codex-cloud-development-design.md)
