# Mobile LP Balanced Pop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未ログインLPの構成・コピー・導線を維持したまま、ブランドオレンジにティール・イエロー・パープルを加えた「Balanced Pop」配色へ刷新する。

**Architecture:** LP専用色を `globals.css` のCSS変数とTailwindテーマへ追加し、各LPコンポーネント内の静的な表示設定から使用する。認証分岐、ルート、状態管理、アセット、コンポーネント境界は変更せず、Server Component構成も維持する。

**Tech Stack:** Next.js 16、React 19、TypeScript、Tailwind CSS 4、Vitest、Playwright

## Global Constraints

- ブランドオレンジ `--primary: #fb5b01` は変更しない。
- 追加色は `--pop-teal: #12a4a1`、`--pop-teal-soft: #dff5f1`、`--pop-yellow: #f6c644`、`--pop-yellow-soft: #fff3c9`、`--pop-purple: #9370db`、`--pop-purple-soft: #eee7ff`、`--pop-coral-soft: #ffe4d5`、`--lp-cream: #fff8ee` とする。
- 色をTSXへ16進値でハードコードせず、Tailwindテーマへ公開したトークンだけを使う。
- グラデーション、CSSで描く装飾、絵文字、新規画像アセット、新規共有モジュール、新規Client Componentは追加しない。
- ページ構成、セクション順、画像、コピー、「ボランティー」表記、リンク先、認証後ホーム、FAQとモバイルメニューの挙動を変更しない。
- 本文は `text-text-dark` / `text-text-body` を維持し、問題・解決や選択状態を色だけで伝えない。
- 新しいアニメーションは追加せず、既存の `Reveal` 動作を変更しない。

---

## File Map

- `app/src/app/globals.css`: LP専用カラートークンとTailwindカラー名の唯一の定義元。
- `app/src/app/components/lp/LPHeroSection.tsx`: ヒーローのクリーム面、ティールラベル、句読点の多色化。
- `app/src/app/components/lp/DiagnosisTypesCarousel.tsx`: 活動スタイル面と4カードのアクセント。
- `app/src/app/components/lp/PainPointsSection.tsx`: 問題側コーラル、解決側ティール。
- `app/src/app/components/lp/UsageSection.tsx`: ティール面、3ステップ、BIG FIVE、結果カード。
- `app/src/app/components/lp/DiagnosisTypesGrid.tsx`: 10タイプの白カードとPOPアクセント。
- `app/src/app/components/lp/BenefitsSection.tsx`: パープル面と3カードのアクセント。
- `app/src/app/components/lp/VoicesSection.tsx`: ティール面と3ラベルのアクセント。
- `app/src/app/components/lp/FeaturesSection.tsx`: 4機能カードの色ローテーション。
- `app/src/app/components/lp/FAQSection.tsx`: Qラベルの色ローテーション。
- `app/src/app/components/lp/LPFooter.tsx`: リンクホバーをティールへ変更。
- `app/e2e/guards.spec.ts`: 既存の390×844未ログインLP回帰テストを実行。振る舞い追加がないためテストコードは変更しない。
- `docs/design/lp-mobile-reference/design-qa.md`: Balanced Pop比較結果、操作確認、最終判定。
- `docs/design/lp-mobile-reference/qa/`: 390×844の実装スクリーンショットと同一画像内の比較結果。

---

### Task 1: LP専用カラートークンを追加する

**Files:**
- Modify: `app/src/app/globals.css`

**Interfaces:**
- Consumes: 既存の `:root` と `@theme inline`。
- Produces: `bg-pop-teal`、`bg-pop-teal-soft`、`bg-pop-yellow`、`bg-pop-yellow-soft`、`bg-pop-purple`、`bg-pop-purple-soft`、`bg-pop-coral-soft`、`bg-lp-cream` と対応する `text-*` / `border-*` ユーティリティ。

- [ ] **Step 1: 変更前のトークン不在を確認する**

Run:

```bash
rg -n -- '--pop-teal|--pop-yellow|--pop-purple|--pop-coral-soft|--lp-cream' app/src/app/globals.css
```

Expected: 一致なし（終了コード1）。

- [ ] **Step 2: `:root` にLP専用トークンを追加する**

`--primary-light` の直後へ追加する。

```css
  /* 未ログインLP: Balanced Pop */
  --pop-teal: #12a4a1;
  --pop-teal-soft: #dff5f1;
  --pop-yellow: #f6c644;
  --pop-yellow-soft: #fff3c9;
  --pop-purple: #9370db;
  --pop-purple-soft: #eee7ff;
  --pop-coral-soft: #ffe4d5;
  --lp-cream: #fff8ee;
```

- [ ] **Step 3: Tailwindテーマへ全トークンを公開する**

`@theme inline` のブランドカラー定義の直後へ追加する。

```css
  --color-pop-teal: var(--pop-teal);
  --color-pop-teal-soft: var(--pop-teal-soft);
  --color-pop-yellow: var(--pop-yellow);
  --color-pop-yellow-soft: var(--pop-yellow-soft);
  --color-pop-purple: var(--pop-purple);
  --color-pop-purple-soft: var(--pop-purple-soft);
  --color-pop-coral-soft: var(--pop-coral-soft);
  --color-lp-cream: var(--lp-cream);
```

- [ ] **Step 4: トークンが正確に定義されたことを確認する**

Run:

```bash
rg -n -- '--pop-teal: #12a4a1|--pop-yellow: #f6c644|--pop-purple: #9370db|--lp-cream: #fff8ee|--color-pop-teal|--color-lp-cream' app/src/app/globals.css
```

Expected: CSS変数4件とTailwindマッピング2件を含む一致が表示される。

---

### Task 2: ファーストビューから課題解決までをBalanced Popへ変更する

**Files:**
- Modify: `app/src/app/components/lp/LPHeroSection.tsx`
- Modify: `app/src/app/components/lp/DiagnosisTypesCarousel.tsx`
- Modify: `app/src/app/components/lp/PainPointsSection.tsx`
- Test: `app/src/app/components/lp/LPHeroSection.test.tsx`
- Test: `app/src/app/components/lp/DiagnosisTypesCarousel.test.tsx`
- Test: `app/src/app/components/lp/PainPointsSection.test.tsx`

**Interfaces:**
- Consumes: Task 1のTailwindカラー、既存 `lpAssets`、既存リンクと見出し。
- Produces: クリームのヒーロー、イエローの活動スタイル面、コーラル→ティールの課題解決表現。

- [ ] **Step 1: 既存の意味的回帰テストを実行する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/LPHeroSection.test.tsx src/app/components/lp/DiagnosisTypesCarousel.test.tsx src/app/components/lp/PainPointsSection.test.tsx
```

Expected: 全テストPASS。配色変更前の意味・リンク・コピーの基準として記録する。

- [ ] **Step 2: ヒーローへクリーム面と多色アクセントを適用する**

`LPHeroSection` の外側sectionとラベル、句読点を次のクラスへ変更する。

```tsx
<section className="relative z-10 -mx-4 overflow-hidden bg-lp-cream px-4 py-8 sm:-mx-6 sm:px-6 sm:py-12 lg:mx-0 lg:rounded-[40px] lg:px-10 lg:py-16">
```

```tsx
<p className="mb-6 inline-flex items-center gap-2 rounded-full border border-pop-teal/25 bg-pop-teal-soft px-4 py-2 text-xs font-bold text-text-dark shadow-sm sm:text-sm">
  <Brain className="size-4 text-pop-teal" aria-hidden />
```

```tsx
<span className="block">つながる<span className="text-primary">、</span></span>
<span className="block">みつかる<span className="text-pop-teal">、</span></span>
<span className="block">変わっていく<span className="text-pop-purple">。</span></span>
```

CTA、画像、信頼項目、リンク先は変更しない。

- [ ] **Step 3: 活動スタイルへ4色の静的設定を追加する**

`FEATURED_STYLES` の `accent` を順番に次へ置換する。

```tsx
accent: "bg-pop-coral-soft text-primary border-primary/20",
accent: "bg-pop-teal-soft text-pop-teal border-pop-teal/20",
accent: "bg-pop-yellow-soft text-warning border-pop-yellow/30",
accent: "bg-pop-purple-soft text-pop-purple border-pop-purple/20",
```

sectionとラベルへ次を適用する。

```tsx
<section id="styles" className="relative -mx-4 bg-pop-yellow-soft/60 px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28 lg:mx-0 lg:rounded-[40px] lg:px-10">
```

```tsx
<div className={`mb-4 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-bold ${style.accent}`}>
```

- [ ] **Step 4: 課題カードをコーラルからティールへ流れる表現にする**

問題行と解決行を次の色へ変更する。

```tsx
<div className="flex items-center gap-3 rounded-2xl bg-pop-coral-soft px-4 py-3 text-sm font-medium text-text-body">
  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary">
```

```tsx
<ArrowDown className="my-2 ml-3 size-4 text-pop-teal" aria-hidden />
<div className="flex items-center gap-3 rounded-2xl bg-pop-teal-soft px-4 py-3 text-sm font-bold text-text-dark">
  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pop-teal text-white">
```

`CircleHelp`、`Check`、問題文、解決文を残し、意味を色だけに依存させない。

- [ ] **Step 5: 意味的回帰テストを再実行する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/LPHeroSection.test.tsx src/app/components/lp/DiagnosisTypesCarousel.test.tsx src/app/components/lp/PainPointsSection.test.tsx
```

Expected: 全テストPASS。見出し、CTA、カード内容が維持される。

---

### Task 3: 使い方と10タイプへPOPカラーを展開する

**Files:**
- Modify: `app/src/app/components/lp/UsageSection.tsx`
- Modify: `app/src/app/components/lp/DiagnosisTypesGrid.tsx`
- Test: `app/src/app/components/lp/UsageSection.test.tsx`
- Test: `app/src/app/components/lp/DiagnosisTypesCarousel.test.tsx`

**Interfaces:**
- Consumes: Task 1のTailwindカラー、既存の `STEPS` / `TRAITS` / `ACTIVITY_STYLE_TYPES`。
- Produces: 3色のステップラベル、5色の特性面、濃いティールの結果カード、白地の10タイプカード。

- [ ] **Step 1: 既存の使い方・タイプテストを実行する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/UsageSection.test.tsx src/app/components/lp/DiagnosisTypesCarousel.test.tsx
```

Expected: 全テストPASS。

- [ ] **Step 2: ステップと特性へ静的アクセントを追加する**

`STEPS` の各要素へ次の `accent` を順に追加する。

```tsx
accent: "bg-pop-coral-soft text-primary border-primary/20",
accent: "bg-pop-teal-soft text-pop-teal border-pop-teal/20",
accent: "bg-pop-purple-soft text-pop-purple border-pop-purple/20",
```

`TRAITS` をラベルとaccentの配列へ置換する。

```tsx
const TRAITS = [
  { label: "外向性", accent: "bg-pop-coral-soft" },
  { label: "協調性", accent: "bg-pop-teal-soft" },
  { label: "誠実性", accent: "bg-pop-yellow-soft" },
  { label: "情緒安定性", accent: "bg-pop-purple-soft" },
  { label: "知性・想像性", accent: "bg-lp-cream" },
] as const;
```

ラベル出力は次へ変更する。

```tsx
<span className={`absolute top-4 left-4 rounded-full border px-3 py-1.5 text-xs font-black tracking-[0.14em] shadow-sm ${step.accent}`}>
```

```tsx
{TRAITS.map((trait) => (
  <li key={trait.label} className={`rounded-2xl px-3 py-4 text-center text-sm font-bold text-text-dark ${trait.accent}`}>
    {trait.label}
  </li>
))}
```

- [ ] **Step 3: 使い方セクションと結果カードをティール基調へ変更する**

```tsx
<section id="usage" className="rounded-[40px] bg-pop-teal-soft px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
```

```tsx
<div className="flex flex-col justify-between rounded-[28px] bg-secondary-dark p-6 text-white shadow-sm sm:p-8">
```

結果カード内の白文字は維持し、コントラストを確保する。

- [ ] **Step 4: 10タイプの表示設定をPOPトークンへ統一する**

`TYPE_DISPLAY` の型と値を次の形へ変更する。

```tsx
const TYPE_DISPLAY: Record<string, { icon: typeof Users; color: string; border: string }> = {
  "innovator-leader": { icon: Star, color: "bg-pop-coral-soft text-primary", border: "border-t-primary" },
  "supporter-care": { icon: Heart, color: "bg-pop-teal-soft text-pop-teal", border: "border-t-pop-teal" },
  "creative-solo": { icon: Lightbulb, color: "bg-pop-purple-soft text-pop-purple", border: "border-t-pop-purple" },
  "perfectionist-analyst": { icon: BarChart2, color: "bg-pop-yellow-soft text-warning", border: "border-t-pop-yellow" },
  "charisma-entertainer": { icon: MessageCircle, color: "bg-pop-coral-soft text-primary", border: "border-t-primary" },
  "strategist-planner": { icon: Zap, color: "bg-pop-teal-soft text-pop-teal", border: "border-t-pop-teal" },
  "harmony-mediator": { icon: Handshake, color: "bg-pop-yellow-soft text-warning", border: "border-t-pop-yellow" },
  "adventure-explorer": { icon: Compass, color: "bg-pop-purple-soft text-pop-purple", border: "border-t-pop-purple" },
  "conservative-guardian": { icon: Shield, color: "bg-pop-teal-soft text-pop-teal", border: "border-t-pop-teal" },
  "sensitive-artist": { icon: Users, color: "bg-pop-coral-soft text-primary", border: "border-t-primary" },
};
```

fallbackにも `border` を追加し、カードへ `border-t-4 ${display.border}` を適用する。カード背景は白のままにする。

- [ ] **Step 5: 回帰テストを再実行する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/UsageSection.test.tsx src/app/components/lp/DiagnosisTypesCarousel.test.tsx
```

Expected: 全テストPASS。3ステップ、5特性、10タイプの文言と件数が維持される。

---

### Task 4: 後半セクションへBalanced Popを一貫して展開する

**Files:**
- Modify: `app/src/app/components/lp/BenefitsSection.tsx`
- Modify: `app/src/app/components/lp/VoicesSection.tsx`
- Modify: `app/src/app/components/lp/FeaturesSection.tsx`
- Modify: `app/src/app/components/lp/FAQSection.tsx`
- Modify: `app/src/app/components/lp/LPFooter.tsx`
- Test: `app/src/app/components/lp/BenefitsSection.test.tsx`
- Test: `app/src/app/components/lp/VoicesSection.test.tsx`
- Test: `app/src/app/components/lp/FeaturesSection.test.tsx`
- Test: `app/src/app/components/lp/FAQSection.test.tsx`
- Test: `app/src/app/components/lp/LPFooter.test.tsx`

**Interfaces:**
- Consumes: Task 1のTailwindカラーと既存配列。
- Produces: パープルのメリット面、ティールの利用イメージ面、4色の機能、FAQの色ローテーション、ティールのフッターホバー。

- [ ] **Step 1: 後半セクションの意味的回帰テストを実行する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/BenefitsSection.test.tsx src/app/components/lp/VoicesSection.test.tsx src/app/components/lp/FeaturesSection.test.tsx src/app/components/lp/FAQSection.test.tsx src/app/components/lp/LPFooter.test.tsx
```

Expected: 全テストPASS。

- [ ] **Step 2: メリットへ3色の静的アクセントを追加する**

`BENEFITS` へ順番に次の `accent` と `badge` を追加する。

```tsx
accent: "border-b-primary",
badge: "bg-pop-coral-soft text-primary",
accent: "border-b-pop-teal",
badge: "bg-pop-teal-soft text-pop-teal",
accent: "border-b-pop-yellow",
badge: "bg-pop-yellow-soft text-warning",
```

sectionをパープル淡色面へ変更する。

```tsx
<section id="benefits" className="-mx-4 bg-pop-purple-soft/70 px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28 lg:mx-0 lg:rounded-[40px] lg:px-10">
```

カードへ `border-b-4 ${benefit.accent}`、番号へ `${benefit.badge}` を適用する。画像にオーバーレイは追加しない。

- [ ] **Step 3: 利用イメージの面とラベルを多色化する**

`VOICES` へ順番に次の `accent` を追加する。

```tsx
accent: "bg-pop-coral-soft text-primary",
accent: "bg-pop-yellow-soft text-warning",
accent: "bg-pop-purple-soft text-pop-purple",
```

sectionを `bg-pop-teal-soft`、ラベルを `${voice.accent}` に変更する。人物写真、役割、注記は維持する。

- [ ] **Step 4: 4機能へ補助色を1色ずつ割り当てる**

`FEATURES` へ次の `accent` を追加する。

```tsx
accent: "bg-pop-coral-soft text-primary",
accent: "bg-pop-teal-soft text-pop-teal",
accent: "bg-pop-yellow-soft text-warning",
accent: "bg-pop-purple-soft text-pop-purple",
```

アイコン面を `className={`mb-5 flex size-12 items-center justify-center rounded-2xl ${item.accent}`}` へ変更する。既存Lucideアイコンを維持する。

- [ ] **Step 5: FAQのQラベルを色ローテーションする**

配列をコンポーネント外へ追加する。

```tsx
const QUESTION_COLORS = [
  "text-primary",
  "text-pop-teal",
  "text-pop-purple",
  "text-warning",
] as const;
```

map内で次を定義し、QラベルとChevronへ適用する。

```tsx
const questionColor = QUESTION_COLORS[i % QUESTION_COLORS.length];
```

```tsx
<span className={`text-base font-black ${questionColor}`}>Q.</span>
<ChevronDown className={`size-5 shrink-0 transition-transform duration-200 ${questionColor} ${openIndex === i ? "rotate-180" : ""}`} />
```

開閉状態、`aria-expanded`、buttonのフォーカス・ホバー挙動は変更しない。

- [ ] **Step 6: フッターのリンクホバーをティールへ変更する**

```tsx
<Link href={link.href} className="text-sm text-text-body transition-colors hover:text-pop-teal">
```

ボトムCTAはブランドオレンジと既存の `orbitMotif` をそのまま使用し、構造変更しない。

- [ ] **Step 7: 後半セクションの意味的回帰テストを再実行する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/BenefitsSection.test.tsx src/app/components/lp/VoicesSection.test.tsx src/app/components/lp/FeaturesSection.test.tsx src/app/components/lp/FAQSection.test.tsx src/app/components/lp/LPFooter.test.tsx
```

Expected: 全テストPASS。カード件数、文言、FAQ開閉、フッターリンクが維持される。

---

### Task 5: 全体検証とモバイルDesign QAを完了する

**Files:**
- Verify: `app/e2e/guards.spec.ts`
- Modify: `docs/design/lp-mobile-reference/design-qa.md`
- Create/Replace: `docs/design/lp-mobile-reference/qa/implementation-*-390x844.png`
- Create/Replace: `docs/design/lp-mobile-reference/qa/compare-*.jpg`

**Interfaces:**
- Consumes: Task 1〜4の実装、承認済みA案モック、既存Playwrightモバイルシナリオ。
- Produces: 単体・E2E・lint・build結果と、同一画像内比較を含む `final result: passed` のQA記録。

- [ ] **Step 1: 変更範囲を確認してテスト区分を確定する**

Run:

```bash
git diff --name-only
```

Expected:

- UT: 必須。既存LPコンポーネントテストを回帰テストとして使用する。ロジック・コピー・導線は追加しないため新規UTは追加しない。
- E2E: 必須。画面変更のため `app/e2e/guards.spec.ts` の390×844シナリオでメニュー、FAQ、CTA、横あふれを確認する。

- [ ] **Step 2: 全単体テストを実行する**

Run:

```bash
cd app && npm test
```

Expected: 全テストPASS。

- [ ] **Step 3: lintを実行する**

Run:

```bash
cd app && npm run lint
```

Expected: エラー0。

- [ ] **Step 4: 本番ビルドを実行する**

Run:

```bash
cd app && npm run build
```

Expected: build成功。

- [ ] **Step 5: 未ログインLPのE2Eを実行する**

Run:

```bash
cd app && npx playwright test e2e/guards.spec.ts --grep "未ログインLP（モバイル）"
```

Expected: 390×844の主要コンテンツ・メニュー・FAQ・CTA・横あふれテストがPASS。

- [ ] **Step 6: 390×844で実画面を撮影する**

開発サーバーを起動し、ユーザーが選択したブラウザーで次を確認・撮影する。

```bash
cd app && npm run dev
```

撮影対象:

- ヒーロー
- 活動スタイル
- 課題解決
- 使い方
- 10タイプ
- メリット
- 利用イメージ
- 主な機能
- FAQ（2件目を展開）
- ボトムCTAとフッター

Expected: `document.documentElement.scrollWidth === 390`、画像読み込み失敗0、メニューとFAQが操作可能、CTAリンクが仕様どおり。

- [ ] **Step 7: A案モックと実装を同一画像内で比較する**

各比較画像を `docs/design/lp-mobile-reference/qa/compare-*.jpg` へ保存し、次を目視確認する。

- オレンジ、ティール、黄色、紫がLP全体へ一貫して現れる。
- 強い色面が連続せず、写真とウォームホワイトの余白が残る。
- 本文と白抜き文字の可読性が落ちていない。
- 角丸、余白、画像クロップ、見出し折り返しに破綻がない。

- [ ] **Step 8: Design QA記録を更新する**

`docs/design/lp-mobile-reference/design-qa.md` に次を追記する。

```markdown
## Balanced Pop 更新

- [x] ブランドオレンジを主要CTAに維持した
- [x] ティール・イエロー・パープルをセクションとカードへ一貫して配分した
- [x] 問題・解決、FAQ開閉、導線が色だけに依存していない
- [x] 390px幅で横あふれがない
- [x] A案モックと実装を同一画像内で比較した

final result: passed
```

`passed` は上記確認がすべて完了した場合だけ記録する。

- [ ] **Step 9: 差分と未追跡ファイルを最終確認する**

Run:

```bash
git diff --check && git status --short
```

Expected: whitespaceエラーなし。`.codex/config.toml` と既存ユーザー変更をステージ・編集していない。

---

## Completion Gate Report

完了報告で次を実結果に置き換える。

| 区分 | 判定 | 追加・更新したテスト | RED/GREEN | 最終結果 |
| --- | --- | --- | --- | --- |
| UT | 必須 | 既存LPコンポーネントテストを回帰利用。振る舞い追加なしのため新規追加なし | 変更前PASS / 変更後PASS | `npm test` の結果 |
| E2E | 必須 | `app/e2e/guards.spec.ts` の未ログインLP（モバイル） | 既存シナリオでGREEN確認 | Playwrightの結果 |

実装変更、確認結果、残タスクを日本語でまとめ、未実行または失敗した必須検証があれば完了を宣言しない。
