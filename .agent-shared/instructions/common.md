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

## GitHub Actions workflow変更の暫定レビュー境界

- `.github/workflows/**` の変更を含むcommitは高リスクとして扱い、通常の軽微変更に分類しない。
- Agentはそのcommitを作る前に、未commitのworkflow差分を変更行ごとに trigger、`permissions`、checkout対象、secret参照、外部Action、shell展開の6項目で確認する。commit後やpush/Ready前への先送りは禁止する。
- commit前のIssueまたはPRに `pre-commit`、対象ファイル、判定、6項目の確認結果を記録する。
- 本番secretへの到達性に影響する可能性があれば `yuto90` にエスカレーションし、commit、push、Ready化を止める。
- `.github/workflows/production-db-migrate.yml` の変更は、commit前のIssueまたはPRに記録された別途の明示承認を必須とする。
- push後は人間がmerge前にworkflow差分を再レビューする。
- Cursor、Codex、Orchestratorはworkflow変更を含むPRもmergeしない。最終mergeは人間だけが行う。
- これは規則に従うAgentと人間レビューに依存する暫定的なリスク受容であり、技術的な防止ではない。規則を逸脱して`workflows: write`で新しい`on: push` workflowをpushすれば、人間のPRレビュー前に実行されrepository secretへ到達し得る。将来の`CODEOWNERS`とrequired code-owner reviewもmerge reviewの強制であり、このレビュー前実行を防ぐcontrolではない。

詳細は [ブランチ運用](../../docs/branch-workflow.md) を参照する。

## Cursor Cloud Agent の境界

- `agent-ready` は Cursor Cloud Agent の自律起動専用であり、`cursor/issue-<number>-<slug>` ブランチを使う。Codex Cloud は `codex/*` の人間開始フローを維持する。
- Agent-managed PR は一つの Cursor Agent session である。CI修正、Human Input 復帰、Rework は同じ session、同じ `cursor/*` branch、同じPRを継続し、replacement PRを作らない。
- dispatch、Human Input、Ready、CI retry は自然言語で代用しない固定 HTML marker を使う。marker の正確な形式、投稿者、動的値の検証は [Cursor Cloud Agent運用手順](../../docs/cursor-cloud.md) に従う。
- Cursor Agent は GitHub Project、Project Status、`agent-ready`、`agent-cancel` を変更しない。これらの自動 mutation は trusted GitHub Actions Orchestrator だけが行い、`main` への merge は常に人間だけが行う。
- Cursor Cloud、PR branch、テスト、artifact、Vercel に本番DB・本番サービス・PATを含む本番 secret を登録・出力しない。`CURSOR_AGENT_ORCHESTRATOR_PAT` は、暫定方針を含む導入preflight後も GitHub Environment `agent-orchestrator` の secret にだけ保存する。
- `agent-ready` の有効化、PAT、Project、Cursor Environment の外部設定は [Cursor Cloud Agent運用手順](../../docs/cursor-cloud.md) の暫定リスク受容と live verification を満たすまで実施しない。

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
4. Codex Cloud の設定・依頼手順は [docs/codex-cloud.md](../../docs/codex-cloud.md) を参照し、本番シークレットを Cloud に登録しない。
