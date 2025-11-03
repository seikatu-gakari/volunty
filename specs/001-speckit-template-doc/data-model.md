# データモデル

本フィーチャーは Speckit ワークフローに関する情報を整理するドキュメントを対象とする。

## エンティティ: SpecificationDrivenWorkflowGuide
- **目的**: Speckit と GitHub Copilot を用いた仕様駆動開発の進め方を README で解説するセクション。
- **フィールド**:
  - `title`: README で使用する見出し（例: "Speckit を用いた仕様駆動開発"）。
  - `prerequisites`: Git ブランチ命名規則、環境要件、スクリプトの場所。
  - `workflowSteps`: 各フェーズで実行するコマンドと後続アクションの順序付きリスト。
  - `copilotIntegration`: `.github/copilot-instructions.md` を維持するための手順。
  - `troubleshooting`: 典型的なエラーと対処法。
  - `rerunGuidance`: 要件変更時にスクリプトを再実行する手順。
- **リレーション**: `WorkflowStep` と `TroubleshootingScenario` を集約する。

## エンティティ: WorkflowStep
- **目的**: 実行可能なコマンドを含む番号付きステップを表現する。
- **フィールド**:
  - `order`: 実行順序。
  - `action`: 実施内容の説明。
  - `command`: 対応する CLI コマンド（存在する場合）。
  - `expectedOutcome`: 生成・更新されるファイルまたは得られる出力。
  - `nextStep`: 続けて行うべきタスク。
- **リレーション**: `SpecificationDrivenWorkflowGuide` に属する。

## エンティティ: TroubleshootingScenario
- **目的**: 想定される問題とその解決策を記録する。
- **フィールド**:
  - `symptom`: エラーメッセージや想定外の挙動。
  - `cause`: スクリプトに基づく原因分析。
  - `resolution`: 解決手順。
- **リレーション**: `SpecificationDrivenWorkflowGuide` に属する。
