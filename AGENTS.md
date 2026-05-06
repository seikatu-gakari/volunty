# Agent Instructions — Volunty

## プロジェクト概要

**Volunty**: BIG5性格診断によるボランティアマッチングWebアプリ（参加者・団体・管理者）。UIテキスト・コードコメントは**日本語**統一。

## 技術スタック

| 技術                    | バージョン・補足                         |
| ----------------------- | ---------------------------------------- |
| Next.js (App Router)    | 16 / standalone出力 / React Compiler有効 |
| React / TypeScript      | 19 / 5 / strict mode                     |
| Tailwind CSS / XState   | 4 / 5（@xstate/react 6）                 |
| Supabase Auth           | @supabase/ssr + @supabase/supabase-js    |
| Prisma + pg             | PostgreSQL via Session Pooler            |
| Vitest                  | happy-dom + @testing-library/react       |
| Vercel / Docker Compose | デプロイ（standalone）/ 開発環境         |

**重要設定**: パスエイリアス `@/*` → `app/src/*` / ESLint Flat Config（`eslint.config.mjs`）/ Noto Sans JP

## ディレクトリ構造

```
app/src/
├── app/                      # App Router
│   ├── globals.css           # Tailwind CSS 4 + CSS変数
│   ├── components/           # 共有UIコンポーネント
│   ├── diagnosis/components/ # 診断UI（すべて "use client"）
│   └── [route]/page.tsx      # onboarding / dashboard / mypage / opportunities ...
└── lib/
    ├── personality/          # types.ts / constants.ts / logic.ts / machine.ts
    ├── supabase/             # client.ts / server.ts / middleware.ts
    └── [domain]/             # actions.ts（Server Actions）+ *.test.ts
```

## 開発コマンド

```bash
cd app && npm run dev|build|lint|lint:fix|test
cd app && npx vitest run <file>       # 単体テスト
make up|down|restart|logs|shell|clean # Docker操作
node scripts/sync-mcp-config.mjs      # MCP設定をリポジトリ内で同期
```

## アーキテクチャ・設計

**原則**: Server Components デフォルト / ドメインロジックを `src/lib/` に集約 / XState でフロー管理 / TypeScript strict

**診断フロー (XState)**:
```
idle → answering → checkProgress → calculating → completed
              ↑          │
              └──────────┘（次の質問へ）
```
- DiagnosisWizard(`useMachine`) → QuestionCard / ResultView に props 伝播
- BIG5スコア: Likert 1-5 → `(rawScore - 1) / 4 * 100` で正規化 / 逆転項目: `6 - value`
- タイプ判定: criteria完全一致（priority順）→ ユークリッド距離近似フォールバック

**デザインカラー** (`@theme inline` でTailwindクラス化):
```css
--background: #ffeee2;  --primary: #fb5b01;  --primary-dark: #c74700;
--text-dark:  #6d2700;  --text-body: #8b4513;
```

## コーディング規約

| 項目           | ルール                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `"use client"` | イベント・`useState`・ブラウザAPI を使う場合のみ                                                   |
| 型安全         | `any` 禁止 → `unknown` + 型ガード / ドメイン型は `src/lib/<domain>/types.ts` に集約                |
| インポート     | `@/` エイリアス必須 / 深い相対パス（`../../..`）禁止                                               |
| 状態管理       | グローバル → XState / ローカル → `useState` / `useMemo`・`useCallback` 不要（React Compiler）      |
| スタイリング   | Tailwindユーティリティクラスのみ / カラーハードコード禁止（`bg-primary` 等を使用）                 |
| テスト         | ドメインロジックには必ずユニットテスト / 同ディレクトリに `.test.ts(x)` 配置                       |
| コミット       | Conventional Commits（`feat:` `fix:` `docs:` 等）/ 説明は日本語                                    |
| ファイル配置   | ページ: `src/app/<route>/page.tsx` / 共通UI: `src/app/components/` / ロジック: `src/lib/<domain>/` |

## MCP運用

- MCP設定はVoluntyリポジトリ内でのみ共通化する。グローバル設定には展開しない。
- 共通ソースは `.config/mcp/servers.json` とし、`node scripts/sync-mcp-config.mjs` で各エージェント用設定を生成する。
- GitHub Copilot / VS Code 用は `.vscode/mcp.json`、Claude Code 用ローカル設定は `.mcp.json` を使う。
- `.mcp.json` はローカル生成物かつ `.gitignore` 対象のためコミットしない。
- GitHub MCPの認証情報は `GITHUB_MCP_TOKEN` 環境変数からのみ注入し、tracked fileへトークンを書かない。

## 実装ステータス

**完了 ✅**: BIG5診断50問 / 診断結果10類型 / 診断ウィザードUI / トップページ / レスポンシブUI / XState制御

**未実装 ❌**: OAuth認証 / プロフィール登録 / マッチングアルゴリズム / 応募・承認フロー / ダッシュボード / 管理画面 / API層 / DB層（設計済み）

## ドメイン知識

**BIG5特性** (各0-100スコア):

| コード              | 日本語     | 内容                         |
| ------------------- | ---------- | ---------------------------- |
| `extraversion`      | 外向性     | 社交性・活動性・刺激追求     |
| `agreeableness`     | 協調性     | 共感性・協力性・信頼性       |
| `conscientiousness` | 誠実性     | 計画性・責任感・自己統制     |
| `neuroticism`       | 神経症傾向 | 感情の不安定性・ストレス耐性 |
| `openness`          | 開放性     | 好奇心・創造性・新規性受容   |

**10類型**: イノベーター・リーダー / サポーター・ケア / クリエイティブ・ソロ / パーフェクショニスト・アナリスト / カリスマ・エンターテイナー / ストラテジスト・プランナー / ハーモニー・メディエーター / アドベンチャー・エクスプローラー / コンサバティブ・ガーディアン / バランサー・ジェネラリスト

**用語**: Participant(参加者) / Organization(団体) / Opportunity(募集案件) / Application(応募) / Role: `participant|organization|admin`

**主要型定義**:
```typescript
type BIG5Trait = 'extraversion' | 'agreeableness' | 'conscientiousness' | 'neuroticism' | 'openness'

interface BIG5Scores { extraversion: number; agreeableness: number; conscientiousness: number; neuroticism: number; openness: number } // 各0-100

interface PersonalityType {
  id: string; name: string; nameEn: string
  criteria: { [trait]: { min?: number; max?: number } }
  priority: number; description: string; strengths: string[]; suitableActivities: string[]
}

interface PersonalityProfile {
  userId: string; scores: BIG5Scores; timestamp: string
  personalityType: PersonalityType | null          // 完全一致
  closestType: PersonalityType & { distance: number } // 近似一致
}
```

## ブランチ運用

`feature/*` → PR → `preview`（Vercel Preview確認）→ `main`（本番）※ main直接push禁止

## ドキュメントマップ

| ファイル                                    | 内容                                           |
| ------------------------------------------- | ---------------------------------------------- |
| `AGENTS.md`                                 | 全AIエージェント共通のメイン指示書             |
| `CLAUDE.md`                                 | `@AGENTS.md` を import する Claude Code 用入口 |
| `docs/architecture/`                        | システム・基本設計書                           |
| `docs/design/personality-diagnosis-big5.md` | BIG5診断アルゴリズム詳細設計                   |
| `docs/design/database-design.md`            | DB設計書                                       |
| `docs/requirements/mvp-plan.md`             | MVP計画・機能・画面一覧                        |
| `docs/reference/translation-table.md`       | 用語対訳表                                     |
| `docs/quality/status.md`                    | ドメイン別品質グレーディング                   |
| `specs/features.json`                       | MVPフィーチャーリスト（pass/fail付き）         |

## AI開発時の注意事項

1. **既存パターン踏襲**: 診断UI・ロジック層の構造を参考に実装
2. **型安全**: `any` 禁止 / ドメイン型は `types.ts` に集約
3. **テスト必須**: ドメインロジックにはユニットテストを同ディレクトリに配置
4. **Server Component デフォルト**: `"use client"` はインタラクティブ操作時のみ
5. **パスエイリアス**: `@/` 使用 / 深い相対パス禁止
6. **設計書参照**: 新機能実装前に `docs/` の該当設計書を確認
7. **日本語**: UIテキスト・コメント・説明はすべて日本語
8. **カラー**: CSS変数ベースのTailwindクラスを使用（ハードコード禁止）
9. **XState**: 複数ステップのフローはXStateで実装
10. **Supabase認証**: `@/lib/supabase/` 経由 / 直接SDK呼び出し禁止

## RTK — トークン最適化 CLI

シェルコマンドに `rtk` プレフィックスを付けることで出力を60-90%削減:

```bash
# プロジェクトルート
rtk git status|diff|"log -n 10"
rtk docker compose ps

# app/ ディレクトリ
cd app && rtk npm run lint|test
cd app && rtk next build
cd app && rtk tsc --noEmit
cd app && rtk prisma generate

# メタコマンド
rtk gain              # 削減ダッシュボード
rtk gain --history    # コマンド別削減履歴
rtk discover          # 未最適化コマンド発見
```

※ `curl` は除外済み（完全レスポンス必要）/ CI非対応（ローカル専用）/ バイパス: `RTK_DISABLED=1 <cmd>`
