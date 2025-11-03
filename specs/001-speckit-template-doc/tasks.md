---

description: "Task list template for feature implementation"
---

# Tasks: Speckit ワークフロー日本語ドキュメント整備

**Input**: `/specs/001-speckit-template-doc/` の設計ドキュメント
**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/

**テスト方針**: 明示的なテスト要求はないため、各ストーリーの独立検証観点のみを定義する。

**編成方針**: すべてのタスクはユーザーストーリー単位でグルーピングし、各ストーリーが単独でリリースできる状態を保証する。

## フォーマット: `[ID] [P?] [Story] 説明`

- **[P]**: 依存のない並列実行が可能なタスクに付与
- **[Story]**: spec.md で定義したユーザーストーリー（US1, US2, US3）
- すべての説明に編集対象の正確なファイルパスを含める

---

## Phase 1: セットアップ (共有基盤)

**目的**: 仕様駆動ドキュメント整備に必要なリポジトリ構造と既存資料を確認する。

- [ ] T001 リポジトリルートで `.specify/scripts/bash/setup-plan.sh --json` を実行し、出力パスを共有ノートに記録する
- [ ] T002 [P] `specs/001-speckit-template-doc/plan.md` を開き、技術コンテキストと既知の前提条件を抜き出して作業メモを作成する

---

## Phase 2: 基盤整備 (ブロッカー除去)

**目的**: 後続ストーリーで参照する共通資料を更新・整備する。

- [ ] T003 `specs/001-speckit-template-doc/research.md` から意思決定を要約し、README に反映すべき要素を整理する
- [ ] T004 [P] `specs/001-speckit-template-doc/data-model.md` と `specs/001-speckit-template-doc/contracts/workflow-docs.yaml` を確認し、参照する用語の統一ルールを決定してメモ化する

---

## Phase 3: ユーザーストーリー 1 - 前提条件を理解したい (Priority: P1) 🎯 MVP

**ゴール**: コントリビューターが Speckit 実行前に満たすべき条件を README から把握できるようにする。

**独立検証**: README の「前提条件」節のみを読んでブランチ命名・環境準備・必要ディレクトリの存在を確認できる。

### 実装タスク

- [ ] T005 [US1] `README.md` に Speckit 実行前提条件（ブランチ命名規則・Bash 環境・`.specify/` ディレクトリ）を箇条書きで追加する
- [ ] T006 [P] [US1] `README.md` に `git checkout -b NNN-feature` の例と注意事項を記載し、コマンドブロックで示す
- [ ] T007 [US1] `README.md` に `.specify/scripts/bash/check-prerequisites.sh --json` の用途と実行結果の読み取り方を追記する

**チェックポイント**: README の前提条件セクションだけでセットアップが完了できる状態。

---

## Phase 4: ユーザーストーリー 2 - コマンド手順を体系化したい (Priority: P2)

**ゴール**: Speckit の各フェーズで実行するコマンドと成果物の対応関係を段階的に理解できるようにする。

**独立検証**: README のフェーズ別手順を辿るだけで plan → research → design → tasks の流れを再現できる。

### 実装タスク

- [ ] T008 [US2] `README.md` に Phase 0 の手順を詳細化し、`specs/001-speckit-template-doc/plan.md` や `research.md` へのリンク/パスを明記する
- [ ] T009 [P] [US2] `README.md` に Phase 1 の成果物 (`data-model.md`、`contracts/`、`quickstart.md`) を表形式で整理し、作成目的と検証観点を追記する
- [ ] T010 [US2] `README.md` に Phase 2 のタスク生成手順と `.specify/scripts/bash/run-command.sh speckit.tasks` の再実行条件を明文化する

**チェックポイント**: コマンド順序と成果物の対応が README で追跡できる状態。

---

## Phase 5: ユーザーストーリー 3 - Copilot 連携とトラブル対応を把握したい (Priority: P3)

**ゴール**: GitHub Copilot 向けのコンテキスト更新と Speckit スクリプトのエラーハンドリングを README で確認できるようにする。

**独立検証**: Copilot 向け手順とトラブルシューティングを読めば、`.github/copilot-instructions.md` の更新と代表的な失敗の復旧が行える。

### 実装タスク

- [ ] T011 [US3] `README.md` に `.specify/scripts/bash/update-agent-context.sh copilot` の実行手順と `.github/copilot-instructions.md` への反映内容を説明する
- [ ] T012 [P] [US3] `README.md` に Speckit 実行時の代表的なエラーと対処法を表形式で追加する
- [ ] T013 [US3] `README.md` に ワークフロー再実行時の留意点（再生成のタイミング・整合性確認）を整理する

**チェックポイント**: Copilot 連携とエラー対応を README だけで完遂できる状態。

---

## Phase 6: 仕上げ & 横断対応

**目的**: 全ストーリー横断で品質を高め、ドキュメントの一貫性を確保する。

- [ ] T014 [P] `README.md` 全体を校正し、日本語表現や用語の統一を確認する
- [ ] T015 `.github/prompts/` 配下の関連プロンプト（`speckit.plan.prompt.md`、`speckit.specify.prompt.md`、`speckit.tasks.prompt.md`）が日本語出力要件を満たすか再確認し、必要に応じて追記を行う

---

## 依存関係と実行順序

### フェーズ依存
- **Phase 1 → Phase 2**: セットアップ結果が基盤整備の入力となるため順番は固定。
- **Phase 2 → Phase 3 以降**: 共通資料の整備完了が各ユーザーストーリーの前提条件。
- **Phase 3〜5**: 優先度 P1 → P2 → P3 の順に進めるのが最小工数。十分なリソースがあれば Foundational 完了後に並列着手も可能。
- **Phase 6**: 全ストーリー完了後に実施。

### ユーザーストーリー依存
- **US1 (P1)**: Foundational 完了後に着手。US2/US3 からの参照はない。
- **US2 (P2)**: US1 の情報整理を前提に README 構造を拡張するため、US1 完了後に行うのが望ましい。
- **US3 (P3)**: US1/US2 で整備した README セクションに追記していくため、最後に実施する。

### 並列実行の例
- [P] が付いたタスク（T002, T004, T006, T009, T012, T014）は相互依存がないため並列化可能。
- US2 と US3 は Foundational 完了後に部分的に並列作業できるが、README の構成衝突に注意。

---

## 実装戦略

### MVP (US1) 優先
1. Phase 1 と Phase 2 を完了して資料基盤を固める。
2. Phase 3 (US1) を実装し、README の前提条件が十分か確認する。
3. 問題なければ一旦レビューへ回し、早期にフィードバックを得る。

### インクリメンタルデリバリー
1. US1 完了後に US2 を追加し、コマンド手順の詳細化を行う。
2. US2 のレビュー完了後に US3 を実装し、Copilot 連携とトラブル対応を追加する。
3. 最後に Phase 6 で表現統一とプロンプト整備を済ませる。

### チーム並列パターン
- メンバー A: Phase 1〜3 を担当し README の基盤を構築。
- メンバー B: Phase 4 を中心にワークフロー詳細を整備（Foundational 完了後に着手）。
- メンバー C: Phase 5 と Phase 6 で Copilot 連携およびトラブルシューティングを強化。

---

## ノート

- [P] が付与されたタスクは異なるファイルを対象とし、依存がないことを示す。
- 各ストーリーは README の特定セクションのみで検証可能な状態を目指す。
- タスク完了ごとにコミットし、レビューコメントへの対応を容易にする。
- 生成されるドキュメントは日本語で統一し、専門用語は data-model.md の定義に従う。
