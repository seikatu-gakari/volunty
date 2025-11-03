# クイックスタート: GitHub Copilot と Speckit の連携

1. **番号付きフィーチャーブランチを作成**
   ```bash
   git checkout -b 001-your-feature
   ```
   Speckit のスクリプトは `^[0-9]{3}-` で始まるブランチ名でないとエラーになります。

2. **計画関連の成果物を生成**
   ```bash
   .specify/scripts/bash/setup-plan.sh --json
   ```
   出力される `FEATURE_SPEC` `IMPL_PLAN` `SPECS_DIR` のパスを控えます。

3. **`plan.md` を記入**
   - フィーチャー概要と技術コンテキストをまとめ、未確定事項は `NEEDS CLARIFICATION` と記載します。

4. **調査・設計ドキュメントを仕上げる**
   - `research.md`: 不明点を判断・理由付きで解決する。
   - `data-model.md`、`/contracts/`、`quickstart.md`: エンティティ、API 変更、手順を整理する。

5. **GitHub Copilot の指示ファイルを同期**
   ```bash
   .specify/scripts/bash/update-agent-context.sh copilot
   ```
   `plan.md` の内容を基に `.github/copilot-instructions.md` が更新されます。

6. **実装タスクを生成 (Phase 2)**
   ```bash
   .specify/scripts/bash/run-command.sh speckit.tasks
   ```
   `specs/<feature>/tasks.md` が作成され、設計内容と整合していることを確認します。
