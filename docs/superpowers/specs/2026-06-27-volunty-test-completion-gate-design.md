# Volunty Test Completion Gate Design

## 目的

Codex が Volunty の実装・修正・リファクタリングを完了扱いにする前に、変更内容から UT と E2E の追加要否を判断し、必要なテストの追加と実行結果を証拠付きで確認する。

## 現状と不足

- `AGENTS.md` はテスト実行を「可能な限り」としており、テスト追加を完了条件にしていない。
- `volunty-ai-development-guidelines` と `volunty-coding-conventions` はドメインロジックの UT を必須としている。
- Playwright と `make e2e` は存在するが、変更時に E2E を追加すべきか判断するルールがない。
- `volunty-dev-commands` と `git-finish-worktree-pr` は E2E 完了ゲートへ接続されていない。
- CI はDB migrationのみで、UT/E2Eを強制していない。

## 設計

### 新規skill

`.agent-shared/skills/volunty-test-completion-gate/SKILL.md` を作成する。実装完了前に差分を分類し、次の基準を適用する。

- ロジック、Server Action、バリデーション、状態遷移の変更: UTを追加または更新する。
- 画面、フォーム、認証、権限、ルート、複数ロール、DBをまたぐユーザーフローの変更: E2Eを追加または更新する。
- 両方に該当する変更: UTとE2Eの両方を必須にする。
- ドキュメントのみなど動作を変更しない場合: 適用外理由を明記する。

必要なテストが不足する状態、または必要なテストが未実行の状態では完了を宣言しない。

### 既存skill改善

- `volunty-dev-commands`: `make e2e`、UIモード、レポート表示を追加する。
- `volunty-ai-development-guidelines`: 実装完了時に新skillを必須参照する。
- `git-finish-worktree-pr`: commit前に新skillの判定と検証結果を確認する。

### AGENTS.md入口ルール

共通開発ルールへ完了ゲートを1行追加し、Skillルーターへ新skillを追加する。判断基準の詳細はAGENTSへ重複記載しない。

## 検証

- 静的検証スクリプトで必要ファイル、ルーター、相互参照、UT/E2Eコマンドを確認する。
- skill creator の `quick_validate.py` でfrontmatterと命名を検証する。
- `git diff --check` で文書差分を検証する。

## スコープ外

- GitHub ActionsでのUT/E2E実行。
- すべての変更に無条件でE2Eを要求するルール。
- Playwrightテストケース自体の追加。
