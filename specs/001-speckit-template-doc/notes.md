# Speckit ワークフロー作業ノート

## T001: setup-plan 実行結果
- 実行日時: 2025-11-03
- コマンド: `.specify/scripts/bash/setup-plan.sh --json`
- 出力値:
  - `FEATURE_SPEC`: `/(project root)/specs/001-speckit-template-doc/spec.md`
  - `IMPL_PLAN`: `/(project root)/specs/001-speckit-template-doc/plan.md`
  - `SPECS_DIR`: `/(project root)/specs/001-speckit-template-doc`
  - `BRANCH`: `001-speckit-template-doc`
  - `HAS_GIT`: `true`
- メモ: plan.md がテンプレートに上書きされたため、日本語版の内容を再適用済み。

## T002: plan.md 抜粋メモ
- 技術コンテキスト: Markdown (GitHub Flavored)、`.specify/scripts/bash/` 配下の Speckit スクリプト、Git 管理ドキュメント。
- 対象プラットフォーム: GitHub README・ローカルエディタ。
- ゴール: 日本語 README にワークフローを整理し、Copilot 連携を明示。
- 制約: 既存プロンプトと整合し、すべてのドキュメントを日本語で統一すること。

## T003: research.md 要約
- 憲章ゲートは暫定情報として扱い、README で明記する。
- GitHub Copilot 用エージェント更新手順を README に必ず掲載する。
- Speckit のライフサイクル（setup → plan → design → tasks）をコマンド付きで解説する。

## T004: 用語統一メモ
- データモデル上の中核エンティティ名: `SpecificationDrivenWorkflowGuide`, `WorkflowStep`, `TroubleshootingScenario`。
- README で使用する日本語表現: 「ワークフローガイド」「ステップ」「トラブルシューティング」。
- contracts/workflow-docs.yaml の属性: `prerequisites`, `steps`, `troubleshooting` → README では「前提条件」「手順」「トラブル対応」で統一。

## T014: README 校正結果
- 用語: 「前提条件」「手順」「トラブル対応」を README 全体で統一。
- 表記: コマンドはインラインコード／コードブロック、ファイルパスはバッククォートで統一。
- 誤記なしを確認済み。

## T015: プロンプト日本語要件の確認
- `.github/prompts/speckit.plan.prompt.md` に Language Requirement 節を配置済み。
- `.github/prompts/speckit.specify.prompt.md` / `speckit.tasks.prompt.md` も同様に日本語出力を強制する指示を保持していることを再確認。
