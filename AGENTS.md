# Agent Instructions — Volunty

このファイルは常時読み込まれる最小限の入口です。詳細なプロジェクト情報は `.github/skills/` 配下へ分割しています。

## 基本方針

- Volunty は BIG5 性格診断によるボランティアマッチング Web アプリです。
- UI テキスト、コードコメント、説明は日本語で統一します。
- 作業内容に関係する skill だけを読み込み、不要な詳細情報を LLM コンテキストに載せないでください。
- 既存の設計・ディレクトリ・型・テスト方針は該当 skill を読んでから判断してください。

## Skill ルーター

| 必要な情報           | 読み込む skill                                              | 主な用途                                                    |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| プロジェクト概要     | `.github/skills/volunty-project-overview/SKILL.md`          | Volunty の目的、ロール、言語方針を確認する                  |
| 技術スタック         | `.github/skills/volunty-tech-stack/SKILL.md`                | Next.js、React、Prisma、Supabase などの構成を確認する       |
| ディレクトリ構造     | `.github/skills/volunty-directory-structure/SKILL.md`       | ファイル配置、パスエイリアス、探索先を確認する              |
| 開発コマンド         | `.github/skills/volunty-dev-commands/SKILL.md`              | lint、test、build、Docker 操作を実行する                    |
| アーキテクチャ・設計 | `.github/skills/volunty-architecture-design/SKILL.md`       | Server Components、XState、診断フロー、デザイン色を確認する |
| コーディング規約     | `.github/skills/volunty-coding-conventions/SKILL.md`        | 型安全、インポート、スタイリング、テスト配置を確認する      |
| MCP 運用             | `.github/skills/volunty-mcp-operations/SKILL.md`            | `.mcp.json` や GitHub MCP 認証情報の扱いを確認する          |
| ドメイン知識         | `.github/skills/volunty-domain-knowledge/SKILL.md`          | BIG5 特性、10 類型、主要ドメイン型を確認する                |
| ブランチ運用         | `.github/skills/volunty-branch-workflow/SKILL.md`           | feature ブランチ、PR、preview/main への流れを確認する       |
| ドキュメントマップ   | `.github/skills/volunty-document-map/SKILL.md`              | 関連設計書・仕様書の参照先を確認する                        |
| AI 開発時の注意事項  | `.github/skills/volunty-ai-development-guidelines/SKILL.md` | 実装前の確認事項、Supabase・設計書参照ルールを確認する      |
| RTK                  | `.github/skills/volunty-rtk-cli/SKILL.md`                   | ローカルコマンド出力を削減したい時に確認する                |

## 運用ルール

1. タスクを始める前に上表から関係する skill を選び、必要なものだけ読む。
2. 新しい恒久的なプロジェクト知識を追加する場合は、AGENTS.md へ長文を戻さず、該当 skill を更新する。
3. 複数セクションにまたがる作業では、関係する skill を組み合わせて読む。
