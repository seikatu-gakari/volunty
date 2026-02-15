# CLAUDE.md

Volunty — ボランティアマッチング性格診断アプリ。BIG5性格診断（50問）で10類型に分類し、最適なボランティア活動を提案する。現在フロントエンドMVPのみ稼働中。UIテキスト・コメントは日本語。

## Commands

```bash
cd app && npm run dev            # Dev server (localhost:3000)
cd app && npm run build          # Production build
cd app && npm run lint           # ESLint
cd app && npm run lint:fix       # ESLint auto-fix
cd app && npm run test           # Vitest run
cd app && npx vitest run <file>  # Single test file
make up                          # Docker dev server
make down                        # Stop containers
```

## Tech Stack

Next.js 16 (App Router) / React 19 / TypeScript 5 / Tailwind CSS 4 / XState 5 / Vitest + happy-dom
React Compiler enabled. Path alias: `@/*` → `app/src/*`

## Architecture

### Core Modules
- **`app/src/lib/personality/`** — 診断ロジック
  - `types.ts` — BIG5Trait, Question, PersonalityProfile, PersonalityType
  - `constants.ts` — 50問の質問 + 10類型定義（優先度付きマッチング基準）
  - `logic.ts` — スコア計算（Likert 1-5 → 0-100正規化、逆転項目対応）+ タイプ判定
  - `machine.ts` — XState: idle → answering → checkProgress → calculating → completed
- **`app/src/app/diagnosis/components/`** — 診断UI（全て`"use client"`）
  - `DiagnosisWizard.tsx` — メインウィザード（useMachine）
  - `QuestionCard.tsx` — 質問表示
  - `ResultView.tsx` — 結果表示

### Data Flow
XState machine が診断フローの single source of truth。DiagnosisWizard → useMachine() → QuestionCard / ResultView にprops伝播。計算はXState actor（async promise）で実行。

## Documentation Map

全ドキュメント一覧: [`docs/index.md`](docs/index.md)

### Architecture — `docs/architecture/`
- [`overview.md`](docs/architecture/overview.md) — システムアーキテクチャ概要
- [`basic-design.md`](docs/architecture/basic-design.md) — 基本設計書

### Design — `docs/design/`
- [`personality-diagnosis-big5.md`](docs/design/personality-diagnosis-big5.md) — BIG5診断アルゴリズム設計
- [`api-architecture-big5.md`](docs/design/api-architecture-big5.md) — API設計
- [`database-design.md`](docs/design/database-design.md) — DB設計

### Requirements — `docs/requirements/`
- [`mvp-plan.md`](docs/requirements/mvp-plan.md) — MVP計画・機能一覧・画面一覧
- [`requirements-definition.md`](docs/requirements/requirements-definition.md) — 要件定義書
- [`npo-hearing-sheet.md`](docs/requirements/npo-hearing-sheet.md) — NPOヒアリングシート

### Reference — `docs/reference/`
- [`translation-table.md`](docs/reference/translation-table.md) — 用語対訳表

### Quality — `docs/quality/`
- [`status.md`](docs/quality/status.md) — ドメイン別品質グレーディング・ギャップ追跡

## Specs & Features

- [`specs/features.json`](specs/features.json) — MVPフィーチャーリスト（機械可読、pass/fail付き）
- [`specs/personality-diagnosis-functionality.md`](specs/personality-diagnosis-functionality.md) — 性格診断機能仕様

## Agent Resources

- [`.agent/plans/_template.md`](.agent/plans/_template.md) — ExecPlan テンプレート

## Current Status

性格診断（P-3, P-4）とレスポンシブUI（C-3）のみ実装済み。認証・マッチング・API・DBは設計書のみ。詳細は [`specs/features.json`](specs/features.json) と [`docs/quality/status.md`](docs/quality/status.md) を参照。
