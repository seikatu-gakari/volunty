# Agent Instructions — Volunty

このファイルは Volunty リポジトリ専用の Claude Code / Codex 共通入口です。
詳細なプロジェクト情報は `.agent-shared/skills/` 配下へ分割しています。

## 共通開発ルール

- 日本語で簡潔に回答する。
- 変更前に方針を説明する。
- 破壊的変更は必ず確認する。
- TypeScript では型安全性を優先する。
- テスト、lint、型チェックを可能な限り実行する。
- 実装・修正・リファクタリング完了前に `volunty-test-completion-gate` で UT/E2E の追加要否を判定し、必要なテストを追加・実行する。
- 実装後に変更点、確認結果、残タスクをまとめる。
- Codex Cloud の作業ブランチは `codex/<topic>`、Pull Request の base は `main` とする。`main` へのマージは人間が行う。
- feature ブランチへの push で作成される Vercel Preview を確認し、CI と Codex Review が成功してから PR を完成扱いにする。
- Codex Cloud のNext.js buildは `cd app && npm run build -- --webpack` を使用する。
- Codex CloudではMCPブリッジを使わずCLIを優先する。ドキュメント検索は `ctx7`、ブラウザ/E2EはPlaywright、DBはPrisma、UTはVitest、lintはESLint、型チェックはTypeScript、コード検索は `rg` / `git grep` を使用する。ローカル環境のネイティブMCP設定は維持する。
- Codex Cloudではセットアップ済みの `vercel` CLIを使用できるが、Vercel tokenをCloudへ登録せず、Previewデプロイはfeatureブランチへのpushで行う。

## 基本方針

- Volunty は BIG5 性格診断によるボランティアマッチング Web アプリです。
- UI テキスト、コードコメント、説明は日本語で統一します。
- 作業内容に関係する skill だけを読み込み、不要な詳細情報を LLM コンテキストに載せないでください。
- 既存の設計・ディレクトリ・型・テスト方針は該当 skill を読んでから判断してください。

## Skill ルーター

| 必要な情報           | 読み込む skill                                              | 主な用途                                                    |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| 技術スタック         | `.agent-shared/skills/volunty-tech-stack/SKILL.md`                | Next.js、React、Prisma、Supabase などの構成を確認する       |
| ディレクトリ構造     | `.agent-shared/skills/volunty-directory-structure/SKILL.md`       | ファイル配置、パスエイリアス、探索先を確認する              |
| 開発コマンド         | `.agent-shared/skills/volunty-dev-commands/SKILL.md`              | lint、test、build、Docker 操作を実行する                    |
| アーキテクチャ・設計 | `.agent-shared/skills/volunty-architecture-design/SKILL.md`       | Server Components、XState、診断フロー、デザイン色を確認する |
| コーディング規約     | `.agent-shared/skills/volunty-coding-conventions/SKILL.md`        | 型安全、インポート、スタイリング、テスト配置、設計書参照を確認する |
| MCP 運用             | `.agent-shared/skills/volunty-mcp-operations/SKILL.md`            | `.mcp.json` や GitHub MCP 認証情報の扱いを確認する          |
| ドメイン知識         | `.agent-shared/skills/volunty-domain-knowledge/SKILL.md`          | BIG5 特性、10 類型、主要ドメイン型を確認する                |
| commit / PR / ブランチ運用 | `.agent-shared/skills/git-finish-worktree-pr/SKILL.md`      | commit、push、PR 作成、feature/preview/main の流れを確認する |
| ドキュメントマップ   | `.agent-shared/skills/volunty-document-map/SKILL.md`              | 関連設計書・仕様書の参照先を確認する                        |
| テスト完了判定       | `.agent-shared/skills/volunty-test-completion-gate/SKILL.md`      | 実装完了前に UT/E2E の追加要否と結果を確認する              |
| RTK                  | `.agent-shared/skills/volunty-rtk-cli/SKILL.md`                   | ローカルコマンド出力を削減したい時に確認する                |

## 運用ルール

1. タスクを始める前に上表から関係する skill を選び、必要なものだけ読む。
2. 新しい恒久的なプロジェクト知識を追加する場合は、AGENTS.md へ長文を戻さず、該当 skill を更新する。
3. 複数セクションにまたがる作業では、関係する skill を組み合わせて読む。
4. Codex Cloud の設定・依頼手順は [docs/codex-cloud.md](docs/codex-cloud.md) を参照し、本番シークレットを Cloud に登録しない。

## Cursor Cloud specific instructions

Cursor Cloud エージェント向けの起動時メモ。標準コマンドは [README](../../app/README.md) と [Makefile](../../Makefile)、[開発コマンド skill](../skills/volunty-dev-commands/SKILL.md) を参照する。ここには非自明な注意点だけを記載する。

- **依存関係の更新は自動化済み**: VM 起動時の update script が `cd app && npm ci` と `npm run db:generate` を実行する。手動で入れ直す必要はない。
- **タイムゾーンは `Asia/Tokyo` 必須**: `datetime-local` 変換に依存する UT がある。`TZ` が未設定（UTC）だと `src/lib/dashboard/create-opportunity.test.ts` などが失敗する。`~/.bashrc` に `export TZ=Asia/Tokyo` を設定済み。新規シェルで未反映なら `TZ=Asia/Tokyo npm test` のように明示する。CI も同値。
- **Docker デーモンは手動起動**: このコンテナは systemd 管理外。Supabase local を使う前に `docker info` で確認し、未起動なら `sudo dockerd > /tmp/dockerd.log 2>&1 &` で起動する（ソケット権限が要る場合は `sudo chmod 666 /var/run/docker.sock`）。ストレージドライバは `fuse-overlayfs`（`/etc/docker/daemon.json` で containerd-snapshotter を無効化済み）。
- **Supabase local**: リポジトリルートで `supabase start`（初回はイメージ pull で数分）。マイグレーションと `supabase/seed.sql` は自動適用される。停止は `supabase stop`。DB は `postgresql://postgres:postgres@127.0.0.1:54322/postgres`、API は `http://127.0.0.1:54321`。ローカルの anon / service_role は Supabase 既定のデモ鍵で秘密ではない。
- **`app/.env.local` が必要**（gitignore 済みで未コミット）。無い場合は次を作成する:
  ```
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase start 出力の ANON_KEY>
  SUPABASE_SERVICE_ROLE_KEY=<supabase start 出力の SERVICE_ROLE_KEY>
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
  DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
  E2E_AUTH_ENABLED=true
  E2E_TEST_USER_PASSWORD=volunty-e2e-password
  ```
  鍵は `supabase status -o env`（`ANON_KEY` / `SERVICE_ROLE_KEY`）で再取得できる。
- **手動ログイン（テスト用）**: 実 Google OAuth は使えないため、`E2E_AUTH_ENABLED=true` と `cd app && npm run seed:e2e` の後、ブラウザで `http://localhost:3000/api/test-auth/login?persona=<persona>&next=<path>` を開くとセッション cookie が発行される。persona 一覧は `app/src/lib/test-auth/personas.ts`（例: `participant-onboarded`, `participant-diagnosis`, `organization-approved`, `admin`）。
- **dev サーバー**: `cd app && npm run dev`（`http://localhost:3000`）。`make up` は Docker Compose 経由で Next.js を起動しつつ `supabase start` も行うが、Cloud では `npm run dev` 直接起動の方が軽い。
- **build は webpack 指定**: `cd app && npm run build -- --webpack`（Turbopack ではなく webpack を使う）。
