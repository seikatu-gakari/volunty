# Codex Cloud リモート開発環境 設計

## 目的

Volunty の設計、実装、検証、Pull Request 作成を Codex Cloud で完結できるようにする。
`main` へのマージは人間が GitHub 上で行い、Codex Cloud には本番環境の変更権限を与えない。

## 成功条件

- Codex Cloud がリポジトリをチェックアウトし、依存関係と Prisma Client を再現可能に準備できる。
- Codex Cloud が設計書と実装計画を作成し、承認後に実装できる。
- Codex Cloud が変更内容に応じて lint、UT、build を実行できる。
- Pull Request 上の GitHub Actions が lint、UT、build、E2E を実行できる。
- Codex Cloud が feature ブランチから `main` 向け Pull Request を作成できる。
- feature ブランチへの push で Vercel Preview が自動デプロイされる。
- Codex Cloud は `main` をマージせず、`main` へ直接 push しない。
- 本番 Supabase、Vercel、本番データベースのシークレットを Codex Cloud に登録しない。

## 採用方式

Codex Cloud と GitHub Actions の分担方式を採用する。

| 担当 | 責務 |
| --- | --- |
| Codex Cloud | 要件整理、設計、実装計画、実装、lint、UT、build、feature ブランチへの push、`main` 向け Pull Request 作成 |
| GitHub Actions | Pull Request ごとの lint、UT、build、ローカル Supabase を使った Playwright E2E |
| Codex Code Review | Pull Request の自動レビューと重大な問題の指摘 |
| Vercel | feature ブランチへの push ごとの Preview デプロイ |
| 人間 | 設計・実装計画の承認、Preview 確認、Pull Request レビュー、`main` へのマージ判断 |

Codex Cloud の標準環境で Docker を利用できることに依存しない。Docker を必要とする Supabase E2E は GitHub-hosted runner で実行する。

## 開発フロー

1. 人間が Codex Cloud に Issue、目的、完了条件を渡す。
2. Codex Cloud が関連コードとドキュメントを調査し、設計案を提示する。
3. 人間が設計を承認する。
4. Codex Cloud が実装計画を提示する。
5. 人間が実装計画を承認する。
6. Codex Cloud が `codex/<topic>` ブランチで実装する。
7. Codex Cloud が変更に必要な UT/E2E を判定し、Cloud 内で lint、UT、build を実行する。
8. feature ブランチへの push を契機に、Vercel が Preview を自動デプロイする。
9. Codex Cloud が `main` 向け Pull Request を作成する。
10. GitHub Actions が lint、UT、build、E2E を実行し、Codex Code Review がレビューする。
11. 不合格の場合、Codex Cloud が同じ Pull Request のブランチを修正する。
12. 全必須チェックの成功と Preview の確認後、人間が Pull Request を `main` へマージする。

## リポジトリ変更

### `.codex/cloud/setup.sh`

Codex Cloud の初回セットアップから呼び出す。

- リポジトリルートと `app/package.json` を検証する。
- Node.js 22 系と npm が利用可能であることを検証する。
- `app/` で `npm ci --no-audit` を実行する。
- `npm run db:generate` を実行する。
- Docker、Supabase、開発サーバーは起動しない。
- 本番またはローカルの `.env.local` をコピーしない。

### `.codex/cloud/maintenance.sh`

キャッシュ済み Cloud 環境の再利用時に呼び出す。

- `app/package-lock.json` に従って `npm ci --no-audit` を再実行する。
- Prisma Client を再生成する。
- データベース migration や seed は実行しない。

初回 setup と maintenance は同じ依存関係セットアップ関数を共有し、処理差による環境ドリフトを避ける。

### `.github/workflows/ci.yml`

`main` 向け Pull Request で実行する。

- Node.js 22 を使用する。
- `app/package-lock.json` をキーに npm cache を利用する。
- `npm ci` と Prisma Client 生成を行う。
- lint、UT、Next.js build をそれぞれ独立した結果として確認できるようにする。
- E2E ジョブでは Supabase CLI と Chromium を準備し、既存の `make e2e` 相当を非対話で実行する。
- E2E 失敗時は Playwright の HTML report、trace、screenshot を artifact として保存する。
- Pull Request 由来のコードに本番データベース用 GitHub Secrets を渡さない。

ジョブ構成は、依存関係インストールを重複させすぎず、どの検証が失敗したか判別できる粒度にする。正確な action バージョンは実装時に公式リポジトリの現行リリースを確認して固定する。

### `AGENTS.md`

既存ルールへ Codex Cloud 用の次の制約を短く追加する。

- 複数段階の変更は、設計承認、実装計画承認、実装の順に進める。
- 作業ブランチは `codex/<topic>` とする。
- 開発 Pull Request の base は `main` とする。
- `main` は人間だけがマージする。
- `main` への直接 push、production migration、本番シークレットの参照を禁止する。
- `volunty-test-completion-gate` に基づく検証結果を Pull Request 本文へ記載する。

### `docs/branch-workflow.md`

現在の Vercel 設定と Codex Cloud 運用に合わせて更新する。

- feature ブランチへの push でも Vercel Preview が自動デプロイされることを明記する。
- 標準フローを `codex/<topic>` から `main` への Pull Request に変更する。
- `preview` ブランチを必須の中継地点として扱わない。
- `main` のマージは人間が行うことを維持する。

### `docs/codex-cloud.md`

人間が Codex Cloud と GitHub で行う設定を記録する。

- GitHub リポジトリ接続
- Cloud Environment の作成
- Node.js 22 の選択
- setup script と maintenance script の登録コマンド
- Agent internet access の最小権限
- Codex Code Review と Automatic reviews の有効化
- `main` の branch protection および required checks
- Cloud へ渡してよい環境変数と、登録禁止の本番シークレット
- 設計から Pull Request 作成までの依頼テンプレート
- キャッシュリセットと失敗時の切り分け手順

## Cloud Environment 設定

- Repository: `seikatu-gakari/volunty`
- Runtime: Node.js 22
- Setup command: `bash .codex/cloud/setup.sh`
- Maintenance command: `bash .codex/cloud/maintenance.sh`
- Agent internet access: 原則 off。タスク中の調査に必要な場合だけ、信頼できるドメインと `GET`、`HEAD`、`OPTIONS` に限定する。
- Environment variables: テスト・build に必要な非秘密値だけを登録する。
- Secrets: 依存関係の取得など setup phase だけで必要な資格情報に限定する。本番 Supabase、Vercel、本番 DB の資格情報は登録しない。

Codex Cloud の Secrets は setup phase 後にエージェント環境から除外される。このため、テスト中に必要な資格情報を Secret として渡す設計にはしない。

## GitHub 設定

### Codex

- Codex Cloud から `seikatu-gakari/volunty` へアクセスできるようにする。
- Codex Code Review を有効化する。
- Automatic reviews を有効化する。

### Branch protection

`main` に次を設定する。

- Pull Request 経由の変更を必須にする。
- CI の lint、UT、build、E2E を required checks にする。
- 未解決レビューがある場合のマージを禁止する。
- force push と branch deletion を禁止する。
- 自動マージは有効化しない。

`main` へのマージ後に既存の `Production DB Migration` が動く点は変更しない。Codex Cloud から本番 migration workflow を手動実行しない。

## セキュリティ境界

- `app/.env.local` をコミット、アップロード、Cloud へコピーしない。
- Codex Cloud に本番 DB URL、Supabase service role key、OAuth secret、Vercel token を登録しない。
- E2E は GitHub Actions 内に作成したローカル Supabase のみを利用する。
- fork 由来 Pull Request へ機密情報を渡さない。
- Agent internet access は必要なタスクだけ個別に拡張し、無制限アクセスを既定にしない。
- Codex Cloud に `main` のマージや本番デプロイの責務を持たせない。

## エラー処理

- setup 失敗時は Node.js、npm、`npm ci`、Prisma generate のどこで失敗したかを明示する。
- maintenance 失敗時はキャッシュを信用せず、Cloud Environment の Reset cache 手順を案内する。
- lint、UT、build、E2E は失敗した区分を個別に報告する。
- E2E 失敗時は artifact を保存し、trace と screenshot から再現箇所を確認できるようにする。
- Codex Cloud が Pull Request を作成できない場合は、GitHub 接続権限と対象ブランチの書き込み権限を確認し、`main` への権限緩和で回避しない。

## 検証方針

### 設定・スクリプト

- `bash -n` で setup と maintenance の構文を検証する。
- ShellCheck が利用可能なら実行する。
- Cloud 相当の Linux／Node.js 22 環境で setup を実行する。
- setup と maintenance の再実行が成功することを確認する。
- setup が `.env.local`、Docker、Supabase、本番 migration を必要としないことを確認する。

### アプリケーション

- `cd app && npm run lint`
- `cd app && npm test`
- `cd app && npm run build`
- `make e2e`

E2E は GitHub Actions での成功を最終判定とし、Codex Cloud 内で Docker が使えるかどうかに完了条件を依存させない。

### 運用確認

- Codex Cloud から小さな検証ブランチを作成する。
- feature ブランチへの push で Vercel Preview が作成されることを確認する。
- `main` 向け Pull Request を作成する。
- required checks と Codex Review が自動起動することを確認する。
- Codex Cloud が `main` をマージしない運用になっていることを確認する。

## 対象外

- Codex Cloud による `main` の自動マージ
- 本番 DB migration の変更
- Vercel の本番・Preview環境変数の変更
- 本番 Supabase を使ったテスト
- ローカル Codex App 用 `.codex/environments/default.toml` の置き換え
- 既存の Docker Compose／Supabase ローカル開発フローの変更

## 公式資料

- [Codex Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment.md)
- [Codex agent internet access](https://learn.chatgpt.com/docs/cloud/internet-access.md)
- [Codex code review in GitHub](https://learn.chatgpt.com/docs/third-party/github.md)
- [openai/codex-universal](https://github.com/openai/codex-universal)
