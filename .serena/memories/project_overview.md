# プロジェクト概要

## プロジェクトの目的
このプロジェクト（`spec_driven_template`）は、**Speckitを用いた仕様駆動開発のガイド・テンプレート**です。

主な目的：
- Speckitのプロンプトとスクリプトを使ってフィーチャー計画を管理する
- GitHub Copilotを主エージェントとして利用し、Copilot向け指示ファイルを自動更新する
- フィーチャーの開始・見直し・更新の手順を標準化する

## プロジェクトの特徴
- **仕様駆動開発（Specification-Driven Development）**：フィーチャーごとに仕様・計画・タスクを管理
- **Bashスクリプトベースのワークフロー**：`.specify/scripts/bash/`配下のスクリプトで自動化
- **GitHub Copilot連携**：仕様から自動的にCopilot指示を生成・更新
- **ブランチベースの管理**：`NNN-feature-name`形式のブランチ名規則

## 主要コンポーネント
1. **仕様管理**（`specs/`ディレクトリ）
2. **Bashスクリプト**（`.specify/scripts/bash/`）
3. **テンプレート**（`.specify/templates/`）
4. **Copilot指示**（`.github/copilot-instructions.md`）
5. **ドキュメント**（`docs/`, `README.md`）