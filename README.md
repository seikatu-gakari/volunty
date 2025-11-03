# Speckit を用いた仕様駆動開発ガイド

このプロジェクトでは、[Speckit](https://github.com/specifyapp/speckit) のプロンプトとスクリプトを使ってフィーチャー計画を管理します。GitHub Copilot を主エージェントとして利用するため、Copilot 向け指示ファイルを常に最新化することがワークフローの一部です。以下の手順に従って、フィーチャーの開始・見直し・更新を行ってください。

## 前提条件

- Git ブランチ名は `NNN-feature-name`（例: `001-new-feature`）とし、Speckit スクリプトの接頭辞チェックを通過させる。
- `.specify/scripts/bash/*.sh` を実行できる Bash 互換環境（macOS / Linux / WSL）を用意する。
- `.specify` ディレクトリをリポジトリに含めておく。
- 任意: GitHub Copilot を有効にし、生成される `.github/copilot-instructions.md` をエディタで読み込ませる。
- 事前確認: `.specify/scripts/bash/check-prerequisites.sh --json` をリポジトリルートで実行し、スクリプト群と必要ディレクトリが認識されるかを確認する。

## フェーズ 0: 計画の雛形作成と調査

1. **フィーチャーブランチの作成／切り替え**
   ```bash
   git checkout -b 001-your-feature
   ```
   - 先頭 3 桁の番号は必須。番号なしで実行すると `ERROR: Not on a feature branch` が出力される。
   - 既存ブランチを流用する場合も `git checkout 00X-...` の形式に揃える。

2. **環境チェック**
   ```bash
   .specify/scripts/bash/check-prerequisites.sh --json
   ```
   - `FEATURE_DIR` と `AVAILABLE_DOCS` が表示されれば準備完了。
   - 欠損があれば `.specify/` 配下の権限やブランチ名を再確認する。

3. **計画用ファイルの生成**
   ```bash
   .specify/scripts/bash/setup-plan.sh --json
   ```
   出力される JSON から次の値を控える:
   - `FEATURE_SPEC`: フィーチャー仕様の雛形
   - `IMPL_PLAN`: 実装計画 (`plan.md`)
   - `SPECS_DIR`: 当該フィーチャーの成果物ディレクトリ

4. **`plan.md` の記入**（`IMPL_PLAN` で示されたパス）
   - フィーチャー概要と技術コンテキストを整理し、未確定事項は `NEEDS CLARIFICATION` と明記する。
   - プロジェクト構造や憲章に関する不明点も記録する。
   - 対象ファイル: `specs/<feature>/plan.md` （例: `specs/001-speckit-template-doc/plan.md`）。

5. **`research.md` で不明点を解消**
   `specs/<feature>/research.md` に Decision / Rationale / Alternatives を記載し、`NEEDS CLARIFICATION` がなくなるまで更新する。
   - 対象ファイル: `specs/<feature>/research.md` （例: `specs/001-speckit-template-doc/research.md`）。

## フェーズ 1: 設計成果物と Copilot 連携

1. **設計成果物の整備**（`specs/<feature>/` 配下）
   - `data-model.md`: エンティティ、関係、バリデーションルール。
   - `contracts/`: REST・OpenAPI・GraphQL 変更、または「変更なし」の記録。
   - `quickstart.md`: 今後のコントリビューター向けチェックリスト。

   | ファイル                        | 目的                       | 検証観点                                     |
   | ------------------------------- | -------------------------- | -------------------------------------------- |
   | `specs/<feature>/data-model.md` | 用語とエンティティの整理   | エンティティと README 用語が一致しているか   |
   | `specs/<feature>/contracts/`    | API 変更有無の明示         | 契約ファイルに「変更なし」が記載されているか |
   | `specs/<feature>/quickstart.md` | コントリビューター向け手順 | README の手順と矛盾がないか                  |

2. **GitHub Copilot のコンテキスト更新**
   ```bash
   .specify/scripts/bash/update-agent-context.sh copilot
   ```
   - `plan.md` を解析し `.github/copilot-instructions.md` を更新する。
   - 手動で追記したメモは `<!-- MANUAL ADDITIONS START/END -->` の間に残る。
   - 実行後は `.github/copilot-instructions.md` を開き、`Active Technologies`と`Recent Changes` に最新ブランチ名が反映されているか確認する。

3. **Constitution Check の再確認**
   - `.specify/memory/constitution.md` は現在プレースホルダーのみ。`plan.md` や README でゲートが情報提供目的である旨を明記する。

## フェーズ 2: タスク生成

1. **実装タスクの生成**
   ```bash
   .specify/scripts/bash/run-command.sh speckit.tasks
   ```
   既存の成果物を基に `specs/<feature>/tasks.md` を生成または更新する。
   - `--json` 付きで再実行する必要はないが、成果物を変更した際はコマンドを再度実行してタスクを同期する。

2. **Copilot とタスクを突き合わせる**
   - `.github/copilot-instructions.md` を確認し、最新のスタック／コンテキストを反映できているかチェックする。
   - タスク編集後に必要であれば Copilot 指示ファイルを再生成する。

## トラブルシューティング

| 症状                               | 原因                                                                      | 対処                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ERROR: Not on a feature branch`   | ブランチ名が `NNN-` 接頭辞に準拠していない                                | `git checkout -b 00X-...` でブランチを作り直し、`setup-plan.sh` を再実行する                     |
| Plan テンプレートが見つからない    | `.specify/templates/plan-template.md` が欠損または権限不足                | テンプレートを復元し、必要なら `chmod +x` でスクリプト権限を付与してから再試行                   |
| Copilot 指示ファイルが更新されない | `plan.md` 未保存または `.github/copilot-instructions.md` への書き込み不可 | `plan.md` を保存し、スクリプトを再実行。必要に応じて `chmod` や Git 属性を確認                   |
| `tasks.md` が古いまま              | Speckit タスク生成を再実行していない                                      | 最新の成果物保存後に `.specify/scripts/bash/run-command.sh speckit.tasks` を再実行し、差分を確認 |

## ワークフローの再実行

- フィーチャーを切り替える際は `setup-plan.sh --json` を再実行してパスを確認し、`notes.md` 等にアップデートを追記する。
- `plan.md` や `research.md` を更新したら、必ず `update-agent-context.sh copilot` を再度実行し、Copilot へ最新情報を供給する。
- `data-model.md` / `contracts/` / `quickstart.md` を改訂した場合、`speckit.tasks` を再実行してタスクとの整合性を維持する。
- 実装前レビューでは `tasks.md` と README の手順が一致しているかを突き合わせ、差異があれば再生成を行う。

## ガバナンス状況

プロジェクトの憲章（`.specify/memory/constitution.md`）は現在プレースホルダーです。内容が整備されるまでは、計画内の Constitution Check セクションを情報提供目的として扱い、必要な方針は成果物側に直接記載してください。
