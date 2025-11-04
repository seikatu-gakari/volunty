# コードベース構造

## ディレクトリ構成
```
/
├── README.md                    # メインドキュメント
├── .gitignore                   # Git除外設定
├── docs/                        # プロジェクトドキュメント
│   ├── architecture.md
│   ├── basic-design.md
│   ├── personality-diagnosis-design.md
│   ├── requirements-definition.md
│   └── translation-table.md
├── specs/                       # フィーチャー仕様管理
│   └── 001-speckit-template-doc/
│       ├── plan.md              # 実装計画
│       ├── spec.md              # 仕様書
│       ├── tasks.md             # タスクリスト
│       ├── research.md          # 調査ノート
│       ├── data-model.md        # データモデル
│       ├── quickstart.md        # クイックスタート
│       ├── notes.md             # メモ
│       └── contracts/           # API契約
│           └── workflow-docs.yaml
├── .specify/                    # Speckitワークフロー
│   ├── memory/
│   │   └── constitution.md      # プロジェクト憲章
│   ├── scripts/bash/            # Bashスクリプト
│   │   ├── common.sh
│   │   ├── setup-plan.sh
│   │   ├── check-prerequisites.sh
│   │   ├── update-agent-context.sh
│   │   └── create-new-feature.sh
│   └── templates/               # テンプレート
│       ├── plan-template.md
│       ├── spec-template.md
│       ├── tasks-template.md
│       ├── agent-file-template.md
│       └── checklist-template.md
├── .github/                     # GitHub設定
│   └── copilot-instructions.md  # Copilot指示（自動生成）
└── .vscode/                     # VS Code設定
    └── mcp.json
```

## 重要なファイル
1. **README.md**：メインワークフロードキュメント
2. **specs/NNN-*/plan.md**：各フィーチャーの実装計画
3. **.specify/scripts/bash/*.sh**：ワークフロー自動化スクリプト
4. **.github/copilot-instructions.md**：Copilot指示（自動更新）