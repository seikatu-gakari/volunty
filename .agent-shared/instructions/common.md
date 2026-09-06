# Agent Instructions — Volunty

Volunty は BIG5 性格診断によるボランティアマッチング Web アプリです。回答、UIテキスト、コードコメントは日本語にします。

## 作業範囲と完了条件

- 変更前に方針を短く説明する。調査・設計のみの依頼では実装やファイル作成へ進まない。
- 承認済みの設計・計画は会話やIssueの内容も根拠として引き継ぐ。通常の実装判断、依頼に起因する不具合修正、検証のたびに再承認を求めない。
- TypeScriptの型安全性と既存の設計を保つ。ユーザーの未コミット変更は対象外として保護し、必要ならworktreeで分離する。
- 実装の完了には、依頼された挙動と影響範囲の検証を含める。コードの変更では `volunty-test-completion-gate` でUT/E2Eの必要性と既存カバレッジを判断する。文章・指示だけの変更は内容・参照・構文を確認し、アプリのUT/E2Eは原則不要。
- ローカル検証は変更に見合う範囲で実行する。同じコード・環境で有効な成功結果を手順ごとに繰り返さない。使い捨ての専用環境と確認できたテストは、実行・依頼に起因する失敗の修正・再実行まで続行する。
- 破壊的変更や本番操作は対象と影響を示して承認を得る。秘密情報をtracked fileやCodex Cloudへ登録しない。
- commit・push・PR作成は依頼された到達点まで進める。Codexの新規ブランチは `codex/<topic>`、PRのbaseは `main`。既存の適切な `feature/*` は継続してよい。`main` への直接push・マージは行わない。
- PR完成までの依頼では、作成後の最新HEADについてCI、Vercel Preview、Codex Reviewと指摘対応を確認する。PR作成済みと全ゲート完了を区別する。
- 最後に変更点、確認結果、残タスクを簡潔に報告する。

## 必要なときだけ読むSkill

対象ファイルと依頼から必要な情報を判断し、次のうち該当するものだけ参照する。毎回の全資料読込やリポジトリ全体の把握は前提にしない。

| 必要な情報 | Skill（`.agent-shared/skills/` 配下） |
| --- | --- |
| 採用技術・設定の確認 | `volunty-tech-stack/SKILL.md` |
| 配置先や探索先が不明 | `volunty-directory-structure/SKILL.md` |
| 開発・検証コマンド | `volunty-dev-commands/SKILL.md` |
| 診断・推薦の設計、Server/Client境界、色 | `volunty-architecture-design/SKILL.md` |
| 型・状態管理・スタイリングなどの実装規約 | `volunty-coding-conventions/SKILL.md` |
| MCP設定・認証の扱い | `volunty-mcp-operations/SKILL.md` |
| BIG5・活動スタイル・ドメイン用語 | `volunty-domain-knowledge/SKILL.md` |
| commit・push・PRを依頼された | `git-finish-worktree-pr/SKILL.md` |
| 関連設計書の場所が不明 | `volunty-document-map/SKILL.md` |
| コード変更のUT/E2E判断 | `volunty-test-completion-gate/SKILL.md` |
| ローカルでRTKを使用する | `volunty-rtk-cli/SKILL.md` |

## Codex Cloud

Cloudでは [docs/codex-cloud.md](docs/codex-cloud.md) の環境別手順に従う。buildは `cd app && npm run build -- --webpack`。MCPブリッジへ依存せず用途に応じたCLIを使い、ローカルのネイティブMCP設定は維持する。Previewは作業ブランチのpushで作成し、Vercel tokenや本番シークレットをCloudへ登録しない。
