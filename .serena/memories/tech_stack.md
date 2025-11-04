# 技術スタック

## 主要技術
- **Markdown (GitHub Flavored)**：ドキュメント作成の主要フォーマット
- **Bash Scripts**：ワークフロー自動化（macOS/Linux/WSL対応）
- **Git**：バージョン管理とブランチベースワークフロー
- **YAML**：設定ファイルと契約ファイル

## 開発環境
- **プラットフォーム**：macOS/Linux/WSL (Darwin対応)
- **シェル**：Bash互換環境
- **エディタ**：GitHub Copilot対応エディタ（VS Code等）
- **バージョン管理**：Git

## 外部依存関係
- **Speckit**：仕様駆動開発フレームワーク
- **GitHub Copilot**：AIコーディング支援
- なし：Node.js依存関係はテンプレート用（実際の開発では不使用）

## ファイル構成技術
- **仕様ファイル**：Markdown形式（`specs/*/`）
- **スクリプト**：Bash（`.specify/scripts/bash/`）
- **テンプレート**：Markdown（`.specify/templates/`）
- **設定**：YAML、JSON（`.vscode/`, `.github/`）