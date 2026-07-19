# モバイルLP刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成済み6画面を正本として、未ログイン時のトップページを画像中心のモバイルファーストLPへ刷新する。

**Architecture:** `app/src/app/page.tsx` の認証分岐は維持し、`app/src/app/components/lp/` と未ログイン用ヘッダーだけを更新する。写真・ブランドマーク・装飾は `app/public/lp/mobile/` の実画像として管理し、UIテキスト・CTA・FAQ・カルーセルはHTML/Reactで実装する。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, `next/image`, lucide-react, Vitest, Playwright

## Global Constraints

- 390px幅では `docs/design/lp-mobile-reference/01-hero.png`〜`06-faq-footer.png` を視覚正本とする。
- PCでは既存のレスポンシブ構造を維持し、同じセクションを2〜5カラムへ展開する。
- アプリ名は常に「ボランティー」。LP内に `Volunty` を残さない。
- 既存の `--background` / `--primary` / `--secondary` 等のトークンを使用し、色をハードコードしない。
- 認証済みホーム、診断ロジック、マッチングロジック、DB、Server Actionsは変更しない。
- CTA先は `/diagnosis/trial`、`/opportunities`、`/login`、`/signup`。未実装ページへのリンクは追加しない。
- 体験談は「利用シーンのイメージ例」であることを明記し、参考タイプは断定表現にしない。

---

### Task 1: 参照画像とアセット契約

**Files:**
- Create: `app/src/app/components/lp/lpAssets.ts`
- Create: `app/public/lp/mobile/*.{webp,png}`
- Test: `app/src/app/components/lp/lpAssets.test.ts`

**Interfaces:**
- Produces: `lpAssets` — `{ src: string; alt: string; width: number; height: number; objectPosition?: string }` を各写真・装飾について保持する `as const` オブジェクト。

- [ ] `lpAssets.test.ts` に、全アセットの `/lp/mobile/` パス、空でない日本語alt、正の幅・高さ、重複しないsrcを検証するテストを書く。
- [ ] 対象テストを実行し、`lpAssets` 未定義でREDになることを確認する。
- [ ] ImageGenでヒーロー、4活動スタイル、参加歓迎、診断操作、マッチング操作、3メリット、3利用イメージの写真を個別生成する。CTAは既存写真を別クロップで再利用する。
- [ ] ブランドマークと軌道線装飾は単色クロマキー背景で生成し、`remove_chroma_key.py` で透過PNGに変換する。
- [ ] 最終ファイルを `app/public/lp/mobile/` に保存し、`lpAssets` を実装してGREENにする。

### Task 2: 未ログインヘッダーとファーストビュー

**Files:**
- Create: `app/src/app/components/PublicHeaderNavigation.tsx`
- Modify: `app/src/app/components/Header.tsx`
- Modify: `app/src/app/components/lp/LPHeroSection.tsx`
- Test: `app/src/app/components/PublicHeaderNavigation.test.tsx`, `app/src/app/components/lp/LPHeroSection.test.tsx`

**Interfaces:**
- Produces: `PublicHeaderNavigation()` — モバイルのログイン＋ハンバーガー、デスクトップのアンカー＋登録導線。
- Consumes: `lpAssets.brandMark`, `lpAssets.heroCleanup`。

- [ ] メニューの開閉、アンカー、ログイン/登録、CTA、ブランド名、ヒーローaltを期待するテストを先に追加する。
- [ ] RED確認後、未ログイン時だけ新ナビを表示し、認証済み時は既存 `HeaderAuth` を維持する。
- [ ] ヒーローを画像正本の見出し、写真、2CTA、3つの安心情報へ再構成し、390pxで横スクロールを発生させない。
- [ ] 対象テストをGREENにする。

### Task 3: 活動スタイル・課題・使い方

**Files:**
- Modify: `app/src/app/components/lp/DiagnosisTypesCarousel.tsx`
- Modify: `app/src/app/components/lp/PainPointsSection.tsx`
- Modify: `app/src/app/components/lp/UsageSection.tsx`
- Modify: `app/src/app/components/lp/DiagnosisTypesGrid.tsx`
- Test: 各コンポーネントの同名 `.test.tsx`

**Interfaces:**
- `DiagnosisTypesCarousel` と `DiagnosisTypesGrid` は `ACTIVITY_STYLE_TYPES` を唯一のタイプ名ソースとして使う。
- `UsageSection` は3ステップと5特性プレビューを表示する。

- [ ] 10参考タイプ、3つの課題→解決、3ステップ、5特性名、断定回避注記をassertするテストを書く。
- [ ] 現行の古い8タイプ名と不足UIによりREDになることを確認する。
- [ ] モバイルは横スクロールカード、PCはグリッドへ切り替え、写真は `next/image` で配置する。
- [ ] テストをGREENにし、`prefers-reduced-motion` 時は自動カルーセルを停止する。

### Task 4: メリット・利用イメージ・機能・FAQ・フッター

**Files:**
- Modify: `app/src/app/components/lp/{BenefitsSection,VoicesSection,FeaturesSection,FAQSection,LPBottomCTA,LPFooter}.tsx`
- Test: 対応する `.test.tsx`

**Interfaces:**
- FAQは最初の項目を初期表示し、各ボタンの `aria-expanded` を状態と同期する。
- Footerは既存ルート/アンカーだけを公開する。

- [ ] 3メリット、3利用イメージ＋注記、4機能、6FAQ、2CTA、既存リンクだけをassertするテストを書く。
- [ ] RED確認後、生成画像に合わせて写真コラージュ・カード・CTA・日本語ブランド表記を実装する。
- [ ] FAQとモバイルメニューをキーボード操作可能にし、装飾画像は空alt、内容画像は具体的な日本語altを付ける。
- [ ] 対象テストをGREENにする。

### Task 5: 統合・E2E・デザインQA

**Files:**
- Modify: `app/src/app/page.tsx`, `app/e2e/guards.spec.ts`
- Create: `design-qa.md`

- [ ] 未認証 `/` でブランド、H1、CTA、全セクション、モバイルメニュー、FAQ開閉を検証するPlaywrightテストを追加する。
- [ ] 390×844、768px、1440pxで横スクロール・画像切れ・CTA欠落がないことを確認する。
- [ ] `npx vitest run <LP tests>`、`npm test`、`npm run lint`、`npm run build`、`make e2e` を順に実行する。
- [ ] in-app Browserで390×844の各セクションを撮影し、6枚の参照画像と同じ状態・クロップで比較する。
- [ ] P0/P1/P2差分を修正して再撮影し、`design-qa.md` を `final result: passed` にする。
