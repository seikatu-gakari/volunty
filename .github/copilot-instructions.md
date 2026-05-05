# Copilot Instructions — Volunty

---

## 1. プロジェクト概要

**Volunty** は、BIG5性格診断に基づくボランティアマッチングWebアプリケーションです。

- **目的**: ボランティア希望者の性格特性を診断し、NPO団体との相性を可視化してマッチングを効率化する
- **ユーザー**: ボランティア参加者（個人）、ボランティア募集団体（NPO等）、管理者
- **UIテキスト・コードコメントは日本語**で統一

---

## 2. 技術スタック

| カテゴリ | 技術 | バージョン |
|----------|------|-----------|
| フレームワーク | Next.js (App Router) | 16 |
| UI | React | 19 |
| 言語 | TypeScript | 5 |
| CSS | Tailwind CSS | 4 |
| 状態管理 | XState | 5 |
| XState React | @xstate/react | 6 |
| 認証 | Supabase Auth（@supabase/ssr, @supabase/supabase-js） | - |
| アイコン | lucide-react | - |
| テスト | Vitest + @testing-library/react + happy-dom | - |
| ビルド | Vite（テスト用）/ Next.js（本番） | - |
| デプロイ | Vercel（standalone output） | - |
| コンテナ | Docker Compose（開発環境） | - |

### 重要な設定

- **React Compiler** 有効（`next.config.ts` で `reactCompiler: true`）
- **パスエイリアス**: `@/*` → `app/src/*`（tsconfig.json の paths 設定）
- **出力モード**: `standalone`（Docker/Vercel対応）
- **フォント**: Noto Sans JP（Google Fonts、`--font-noto-sans-jp` CSS変数）
- **ESLint**: Flat Config形式（`eslint.config.mjs`）、next/core-web-vitals + next/typescript

---

## 3. ディレクトリ構造

```
volunty/
├── app/                          # Next.js アプリケーション（ルートディレクトリ）
│   ├── src/
│   │   ├── app/                  # App Router ページ・レイアウト
│   │   │   ├── layout.tsx        # ルートレイアウト（Noto Sans JP、lang="ja"）
│   │   │   ├── page.tsx          # トップページ（LP）— Server Component
│   │   │   ├── globals.css       # Tailwind CSS 4 + カスタムCSS変数
│   │   │   ├── auth/callback/    # Supabase OAuth コールバック
│   │   │   ├── components/       # 共有UIコンポーネント
│   │   │   ├── diagnosis/        # 性格診断ページ
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/   # 診断UI（すべて "use client"）
│   │   │   └── login/            # ログインページ
│   │   ├── lib/
│   │   │   ├── personality/      # 診断ロジック（ドメイン層）
│   │   │   │   ├── types.ts      # 型定義
│   │   │   │   ├── constants.ts  # 50問の質問 + 10類型定義
│   │   │   │   ├── logic.ts      # スコア計算・タイプ判定
│   │   │   │   ├── machine.ts    # XState ステートマシン
│   │   │   │   ├── logic.test.ts
│   │   │   │   └── machine.test.ts
│   │   │   └── supabase/         # Supabase クライアント
│   │   │       ├── client.ts     # ブラウザ用
│   │   │       ├── server.ts     # Server Component 用
│   │   │       └── middleware.ts
│   │   └── proxy.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── vitest.config.mts
│   └── eslint.config.mjs
├── docs/                         # 設計ドキュメント群
├── specs/                        # 仕様書
├── scripts/                      # ユーティリティスクリプト
├── CLAUDE.md                     # Claude Code 用コンテキスト
├── Makefile                      # 開発コマンドショートカット
├── docker-compose.yml
└── vercel.json
```

---

## 4. 開発コマンド

```bash
# ローカル開発
cd app && npm run dev            # Dev server (localhost:3000)
cd app && npm run build          # Production build
cd app && npm run lint           # ESLint
cd app && npm run lint:fix       # ESLint auto-fix
cd app && npm run test           # Vitest run
cd app && npx vitest run <file>  # 単体テストファイル実行

# Docker 開発環境
make up                          # Docker dev server（前面起動）
make down                        # コンテナ停止
make restart                     # 再起動
make logs                        # ログ表示
make shell                       # コンテナ内シェル
make lint                        # コンテナ内 ESLint
make clean                       # コンテナ+ボリューム削除
```

---

## 5. アーキテクチャ・設計方針

### 5.1 コア設計原則

- **App Router 優先**: Server Components をデフォルトとし、インタラクティブなUIのみ `"use client"` を付与
- **ドメインロジック分離**: `src/lib/` にビジネスロジックを集約。UIコンポーネントから独立してテスト可能にする
- **XState によるフロー制御**: 複雑な状態遷移（診断フロー等）はXStateステートマシンで管理。Single Source of Truth
- **型安全**: TypeScript strict mode。型定義は `types.ts` に集約

### 5.2 性格診断アーキテクチャ（実装済み）

#### データフロー
```
DiagnosisWizard (useMachine)
  ├── QuestionCard  ← 現在の質問を props で受け取り表示
  └── ResultView    ← 計算結果を props で受け取り表示

XState Machine:
  idle → answering → checkProgress → calculating → completed
              ↑            │
              └────────────┘ （次の質問へ）
```

#### BIG5 スコア計算
- **Likert 5段階** (1-5) で回答
- **正規化**: 0-100 スケールに変換（`(rawScore - 1) / 4 * 100`）
- **逆転項目**: `reversed: true` の質問は `6 - value` で反転してから計算
- **各特性10問** × 5特性 = 50問

#### 10類型タイプ判定
1. **完全一致判定**: BIG5スコアが類型の `criteria`（min/max範囲）をすべて満たす → `priority` 順で決定
2. **近似一致フォールバック**: 完全一致なしの場合、ユークリッド距離で最も近い類型を選出

### 5.3 デザインシステム（カラー）

```css
--background: #ffeee2;      /* ページ背景（暖色ベージュ） */
--foreground: #6d2700;       /* テキスト色 */
--primary: #fb5b01;          /* プライマリ（オレンジ） */
--primary-dark: #c74700;     /* プライマリ hover */
--text-dark: #6d2700;        /* 見出しテキスト */
--text-body: #8b4513;        /* 本文テキスト */
--card-border: rgba(203, 71, 0, 0.2);
--header-border: rgba(203, 71, 0, 0.1);
```

Tailwind CSS 4 の `@theme inline` で CSS変数をユーティリティクラスとして使用可能（例: `bg-primary`, `text-text-dark`）。

---

## 6. コーディング規約

### 基本方針

最新のモダンなフロントエンド技術（Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, XState 5）に沿って、保守性とパフォーマンスの高いコードを書くこと。実装前に必ず `CLAUDE.md` や `docs/` 内の設計書を参照し、以下の規約に従うこと。

### 6.1 一般ルール
- **日本語**: UIテキスト、コメント、コミットメッセージの説明部分は日本語
- **コミットメッセージ**: Conventional Commits 形式（`feat:`, `fix:`, `docs:` 等）
- **インポート**: パスエイリアス `@/` を使用（`import { Foo } from '@/lib/personality/types'`）
- **コンポーネント**: 関数コンポーネント + `export default`（ページ）/ `export`（共通コンポーネント）
- **状態管理**: グローバル状態は XState マシン。ローカル状態のみ `useState`

### 6.2 TypeScript と型安全性

`strict: true` の TypeScript を前提にした型安全なコードを書くこと。コンパイル時に型を厳密にチェックし、実行時エラーを未然に防ぐ。

- **`any` 禁止**: 不明な型は `unknown` を使い、型ガードで後から判定する
- **型定義の集約**: ドメイン型（`BIG5Trait`、`Question` 等）は `src/lib/<domain>/types.ts` に定義して使い回す
- **パスエイリアス**: インポートは `@/`（`app/src/` を指す）で開始し、深い相対パス（`../../..`）は避ける

### 6.3 Next.js / React コンポーネント

Server Components をデフォルトとし、Client Components との境界を明確に区別すること。

- **Server Components がデフォルト**: 新規コンポーネントは原則 Server Component として作成
- **`"use client"` の条件**: イベントリスナー・`useState`・ブラウザ API を使う場合のみファイル先頭に付与（例: `src/app/diagnosis/components/` 以下）
- **React Compiler**: React 19 の React Compiler が有効なため、手動での `useMemo` / `useCallback` は原則不要

### 6.4 XState による状態管理

複数ステップの操作フロー（診断進行など）は XState 5 で集約管理し、状態の矛盾を防ぐこと（Single Source of Truth）。

- **ロジックの集約**: 状態遷移（例: `idle` → `answering` → `calculating` → `completed`）は `src/lib/<domain>/machine.ts` に定義
- **UIでの利用**: `@xstate/react` の `useMachine` フックで State とイベント送信関数を取得
- **非同期処理**: 重い計算処理は XState の Actor に委譲する

### 6.5 スタイリング（Tailwind CSS v4）

CSS を直接記述せず、常に Tailwind CSS v4 のユーティリティクラスでスタイリングすること。

- **ユーティリティクラス**: `className` 属性にクラス名を直接記述（例: `flex`, `text-primary`, `p-4`）
- **条件付きクラス**: テンプレートリテラルで整理する
- **レスポンシブ**: `md:` / `lg:` プレフィックスでモバイルファーストに実装
- **CSS変数使用**: カラーはハードコードせず Tailwind ユーティリティ（`bg-primary`, `text-text-dark` 等）を使う

### 6.6 ファイル配置ルール
- **ページ**: `src/app/<route>/page.tsx`
- **ページ固有コンポーネント**: `src/app/<route>/components/`
- **共通コンポーネント**: `src/app/components/`
- **ドメインロジック**: `src/lib/<domain>/`
- **テスト**: 対象ファイルと同じディレクトリに `.test.ts(x)` として配置

### 6.7 テストと品質管理（Vitest）

実装したコア機能（特にドメインロジック）は Vitest で単体テストを記述し、挙動の正しさを保証すること。

- **テストランナー**: Vitest（`happy-dom` 環境）
- **コンポーネントテスト**: `@testing-library/react` でユーザー操作ベースのテスト
- **ロジックテスト**: 純粋な関数テスト（`logic.test.ts`）、XState マシンテスト（`machine.test.ts`）
- **エッジケース**: 境界値・異常値を含むアサーションを記述する
- **テスト実行**: `cd app && npm run test`（提出前にすべて PASS を確認）

---

## 7. 現在の実装ステータス

### 実装済み ✅
| 機能 | ID | 品質 |
|------|-----|------|
| BIG5 性格診断（50問） | P-3 | A — テスト済み・本番品質 |
| 診断結果表示（10類型 + スコア） | P-4 | A — テスト済み |
| 診断UIウィザード（進捗バー・戻る） | - | B — 実装完了 |
| トップページ（LP） | S-01 | B — 実装完了 |
| レスポンシブUI | C-3 | B — 診断フローのみ |
| XState 診断フロー制御 | - | A — テスト済み |

### 未実装 ❌（設計書のみ存在）
- OAuth認証（Google）→ Supabase Auth で実装予定
- プロフィール登録（参加者・団体）
- マッチングアルゴリズム（ルールベース）
- 応募・承認フロー
- おすすめ案件一覧
- 団体ダッシュボード
- 管理画面
- API層（REST）
- DB層（設計済み・未実装）

---

## 8. ドメイン知識

### 8.1 BIG5 性格特性

| 日本語 | 英語 | コード内キー | 測定内容 |
|--------|------|-------------|---------|
| 外向性 | Extraversion | `extraversion` | 社交性、活動性、刺激追求 |
| 協調性 | Agreeableness | `agreeableness` | 共感性、協力性、信頼性 |
| 誠実性 | Conscientiousness | `conscientiousness` | 計画性、責任感、自己統制 |
| 神経症傾向 | Neuroticism | `neuroticism` | 感情の不安定性、ストレス耐性 |
| 開放性 | Openness | `openness` | 好奇心、創造性、新規性受容 |

### 8.2 10類型（PersonalityType）

1. **イノベーター・リーダー** — 外向性↑ 開放性↑ 誠実性↑
2. **サポーター・ケア** — 協調性↑ 外向性↑ 神経症傾向↓
3. **クリエイティブ・ソロ** — 開放性↑ 外向性↓ 誠実性中
4. **パーフェクショニスト・アナリスト** — 誠実性↑ 神経症傾向↑ 開放性中
5. **カリスマ・エンターテイナー** — 外向性↑ 協調性↑ 開放性↑
6. **ストラテジスト・プランナー** — 誠実性↑ 開放性↑ 神経症傾向↓
7. **ハーモニー・メディエーター** — 協調性↑ 神経症傾向↓ 外向性中
8. **アドベンチャー・エクスプローラー** — 開放性↑ 外向性↑ 神経症傾向↓
9. **コンサバティブ・ガーディアン** — 誠実性↑ 協調性↑ 開放性↓
10. **バランサー・ジェネラリスト** — 全特性が中間域

### 8.3 主要な型定義

```typescript
type BIG5Trait = 'extraversion' | 'agreeableness' | 'conscientiousness' | 'neuroticism' | 'openness'

interface BIG5Scores {
  extraversion: number      // 0-100
  agreeableness: number     // 0-100
  conscientiousness: number // 0-100
  neuroticism: number       // 0-100
  openness: number          // 0-100
}

interface PersonalityType {
  id: string
  name: string              // 日本語名
  nameEn: string            // 英語名
  criteria: { [trait]: { min?: number; max?: number } }
  priority: number          // 判定優先度
  description: string
  strengths: string[]
  suitableActivities: string[]
}

interface PersonalityProfile {
  userId: string
  scores: BIG5Scores
  personalityType: PersonalityType | null   // 完全一致
  closestType: PersonalityType & { distance: number }  // 近似一致
  timestamp: string
}
```

### 8.4 用語対訳（コード内で使用）

| 日本語 | 英語（コード） | 説明 |
|--------|---------------|------|
| 参加者 | Participant | ボランティア参加希望者 |
| 団体 | Organization | NPO等の募集団体 |
| 募集案件 | Opportunity | 団体が作成する募集情報 |
| 応募 | Application | 参加者→団体への応募 |
| マッチングスコア | Matching Score | 相性数値（0-100） |
| 人物タイプ | Personality Type | BIG5に基づく10類型 |
| 逆転項目 | Reversed Item | スコア反転が必要な質問 |
| ロール | Role | participant / organization / admin |

---

## 9. ブランチ運用・デプロイ

| ブランチ | 用途 | Vercel |
|----------|------|--------|
| `main` | 本番。直接push禁止 | Production |
| `preview` | プレビュー確認 | Preview |
| `develop` | 開発統合 | なし |
| `feature/*` | 機能開発 | なし |

**フロー**: `feature/*` → PR → `preview`（確認）→ `main`（本番デプロイ）

---

## 10. ドキュメントマップ

AIが参照すべき設計ドキュメント:

| ファイル | 内容 |
|----------|------|
| `CLAUDE.md` | プロジェクト全体のクイックリファレンス |
| `docs/architecture/overview.md` | システムアーキテクチャ概要 |
| `docs/architecture/basic-design.md` | 基本設計書 |
| `docs/design/personality-diagnosis-big5.md` | BIG5診断アルゴリズム設計（992行の詳細設計） |
| `docs/design/api-architecture-big5.md` | API設計書 |
| `docs/design/database-design.md` | DB設計書 |
| `docs/requirements/mvp-plan.md` | MVP計画・機能一覧・画面一覧 |
| `docs/requirements/requirements-definition.md` | 要件定義書 |
| `docs/reference/translation-table.md` | 用語対訳表（日英対訳・DB名・システム表現） |
| `docs/quality/status.md` | ドメイン別品質グレーディング |
| `specs/features.json` | MVPフィーチャーリスト（機械可読、pass/fail付き） |
| `specs/personality-diagnosis-functionality.md` | 性格診断機能仕様 |

---

## 11. AI開発時の注意事項

1. **既存パターンに従う**: 新しいコンポーネントやモジュールを作成する際は、既存の実装パターン（診断UIやロジック層の構造）を踏襲すること
2. **型を必ず定義**: `types.ts` にドメイン型を集約。`any` は使用禁止
3. **テストを書く**: ドメインロジックには必ずユニットテストを追加。テストファイルは同ディレクトリに配置
4. **Server Component がデフォルト**: `"use client"` はインタラクティブな操作が必要な場合のみ
5. **パスエイリアス**: `@/` を使用。相対パスでの深いインポート（`../../../`）は避ける
6. **設計書を参照**: 新機能を実装する前に `docs/` 配下の該当設計書を確認し、設計に準拠する
7. **日本語で記述**: UIテキスト、コメント、変数名以外の説明はすべて日本語
8. **CSS変数を使用**: カラーはハードコードせず、Tailwind ユーティリティ（`bg-primary`, `text-text-dark` 等）を使う
9. **XState でフロー管理**: 複数ステップの操作フローはXStateステートマシンで実装する
10. **Supabase 認証**: 認証関連は `@/lib/supabase/` のクライアントを使用。直接 Supabase SDK を呼ばない

---

## 12. RTK — トークン最適化 CLI

**rtk** (Rust Token Killer) はシェルコマンドの出力を LLM へ渡す前にフィルタリング・圧縮する CLI プロキシです。60-90% のトークン削減が実現できます。

### ルール

シェルコマンドを実行する際は `rtk` プレフィックスを付けること:

```bash
# 使わない                    使う
git status                    rtk git status
git log -10                   rtk git log -10
git diff                      rtk git diff
docker compose ps             rtk docker compose ps
npm run lint                  rtk npm run lint
npm run test                  rtk npm run test
next build                    rtk next build
tsc --noEmit                  rtk tsc --noEmit
prisma generate               rtk prisma generate
```

### Volunty プロジェクト固有コマンド

```bash
# Git（プロジェクトルートで実行）
rtk git status
rtk git diff
rtk git log -n 10

# Docker
rtk docker compose ps

# app/ ディレクトリで実行
cd app && rtk npm run lint
cd app && rtk npm run test
cd app && rtk next build
cd app && rtk tsc --noEmit
cd app && rtk prisma generate
```

### メタコマンド（rtk 自体の管理）

```bash
rtk gain              # トークン削減量ダッシュボード
rtk gain --history    # コマンド別の削減履歴
rtk discover          # 未最適化コマンドの発見
```

### 注意事項

- `curl` は hook 除外済み（完全なレスポンスが必要なため）
- CI/CD には使用しない（ローカル開発専用）
- 失敗時は `RTK_DISABLED=1 <command>` で RTK をバイパスできる
