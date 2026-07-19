# LP Hero Organic Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未ログインLPのヒーロー写真を、単純な角丸長方形からBalanced Popに馴染む有機的な非対称カーブへ変更する。

**Architecture:** `LPHeroSection` の画像ラッパーと `Image` だけにTailwindの非対称 `border-radius` を適用する。画像アセット、アスペクト比、`objectPosition`、レイアウト、CTA、認証分岐は維持し、対象コンポーネントの契約テストと既存LP E2Eで回帰を防ぐ。

**Tech Stack:** Next.js 16、React 19、TypeScript、Tailwind CSS 4、Vitest、Testing Library、Playwright

## Global Constraints

- 写真、コピー、CTA、レイアウト順序は変更しない。
- 別の装飾画像、CSS図形、図形レイヤー、アニメーションは追加しない。
- 変更は `LPHeroSection` の画像ラッパーと `Image` の輪郭クラスに限定する。
- モバイルは390px、デスクトップは1024px以上で人物の顔と手元を自然に見せる。
- 既存の `aspect-[4/3]`、`objectPosition`、`priority`、代替テキストを維持する。
- `.codex/config.toml` と `.superpowers/` は今回の変更へ含めない。

---

## File Map

- `app/src/app/components/lp/LPHeroSection.tsx`: ヒーロー写真の白縁、影、非対称カーブを定義する。
- `app/src/app/components/lp/LPHeroSection.test.tsx`: 写真アセット、優先読み込み、CTAに加えて有機的フレームのクラス契約を検証する。
- `docs/design/lp-mobile-reference/qa/implementation-hero-organic-390x844.png`: 390px幅の更新後ヒーロー確認画像。
- `docs/design/lp-mobile-reference/qa/implementation-hero-organic-1024x844.png`: デスクトップ境界での更新後ヒーロー確認画像。
- `docs/design/lp-mobile-reference/design-qa.md`: 注釈画像との比較結果、画像クロップ、横あふれ、回帰検証結果を記録する。

---

### Task 1: ヒーロー写真を有機的な非対称カーブへ変更する

**Files:**
- Modify: `app/src/app/components/lp/LPHeroSection.test.tsx`
- Modify: `app/src/app/components/lp/LPHeroSection.tsx`

**Interfaces:**
- Consumes: `lpAssets.heroCleanup` の `src`、`alt`、`width`、`height`、`objectPosition`。
- Produces: 同じ写真と導線を維持し、モバイルとデスクトップで非対称カーブを持つ `LPHeroSection`。

- [ ] **Step 1: 有機的フレームの失敗テストを書く**

`LPHeroSection.test.tsx` の最初のテストへ、画像自身と親ラッパーの輪郭契約を追加する。

```tsx
const mobileOrganicRadius =
  "rounded-[42%_58%_46%_54%/24%_32%_68%_76%]";
const desktopOrganicRadius =
  "lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]";

expect(image.className).toContain(mobileOrganicRadius);
expect(image.className).toContain(desktopOrganicRadius);
expect(image.parentElement?.className).toContain(mobileOrganicRadius);
expect(image.parentElement?.className).toContain(desktopOrganicRadius);
expect(image.className).not.toContain("rounded-[2.15rem_2.15rem_2.15rem_0.75rem]");
```

- [ ] **Step 2: 対象テストを実行してREDを確認する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/LPHeroSection.test.tsx
```

Expected: 既存の角丸クラスしか存在せず、`rounded-[42%_58%_46%_54%/24%_32%_68%_76%]` の期待がFAILする。

- [ ] **Step 3: 最小実装で輪郭を変更する**

`LPHeroSection.tsx` の画像ラッパーを次のクラスへ置き換える。

```tsx
<div className="overflow-hidden rounded-[42%_58%_46%_54%/24%_32%_68%_76%] bg-white p-1.5 shadow-xl ring-1 ring-card-border lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]">
```

`Image` のクラスを次の内容へ置き換える。

```tsx
className="aspect-[4/3] w-full rounded-[42%_58%_46%_54%/24%_32%_68%_76%] object-cover lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]"
```

既存の `height`、`priority`、`sizes`、`src`、`style`、`width` は変更しない。

- [ ] **Step 4: 対象テストを実行してGREENを確認する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/LPHeroSection.test.tsx
```

Expected: `1 file passed`、既存2テストがすべてPASSする。

- [ ] **Step 5: 対象ファイルのlintと差分を確認する**

Run:

```bash
cd app && npx eslint src/app/components/lp/LPHeroSection.tsx src/app/components/lp/LPHeroSection.test.tsx
cd .. && git diff --check -- app/src/app/components/lp/LPHeroSection.tsx app/src/app/components/lp/LPHeroSection.test.tsx
```

Expected: 両コマンドが終了コード0。

- [ ] **Step 6: 実装をコミットする**

```bash
git add app/src/app/components/lp/LPHeroSection.tsx app/src/app/components/lp/LPHeroSection.test.tsx
git commit -m "feat: ヒーロー画像を有機的な輪郭に変更"
```

---

### Task 2: 実画面QAと回帰検証を完了する

**Files:**
- Create: `docs/design/lp-mobile-reference/qa/implementation-hero-organic-390x844.png`
- Create: `docs/design/lp-mobile-reference/qa/implementation-hero-organic-1024x844.png`
- Modify: `docs/design/lp-mobile-reference/design-qa.md`

**Interfaces:**
- Consumes: Task 1で変更した `LPHeroSection`、起動済み `http://localhost:3000/`、ユーザー注釈の変更前スクリーンショット。
- Produces: 390pxと1024pxの視覚証跡、および `final result: passed` を維持したQA記録。

- [ ] **Step 1: 開発サーバーの応答を確認する**

Run:

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/
```

Expected: `HTTP 200`。応答しない場合は `cd app && npm run dev` で起動する。

- [ ] **Step 2: 390 × 844のヒーローを確認・撮影する**

Codex Desktopのin-app Browserで既存タブを使用し、ホットリロード後のトップを390 × 844で確認する。次を満たした状態を `docs/design/lp-mobile-reference/qa/implementation-hero-organic-390x844.png` へ保存する。

```text
- 写真の四隅が同一の角丸ではなく、左右上下で異なる有機的な曲線
- 白縁と写真の輪郭が一体
- 主要2名の顔と手元が欠けない
- 見出し、説明文、画像、CTAがviewport内
- document.documentElement.scrollWidth === 390
```

- [ ] **Step 3: 1024 × 844のヒーローを確認・撮影する**

同じ未ログイン状態を1024 × 844で確認し、`docs/design/lp-mobile-reference/qa/implementation-hero-organic-1024x844.png` へ保存する。

```text
- 写真が右カラム内へ収まる
- 曲線が横長の単純な楕円に見えない
- 写真と左側コピー・CTAが重ならない
- ページに横方向のオーバーフローがない
```

- [ ] **Step 4: Design QA記録を更新する**

`docs/design/lp-mobile-reference/design-qa.md` の `final result: passed` の直前へ次のセクションを追記する。

```markdown
## 2026-07-17 ヒーロー有機フレーム更新

- user annotationの変更前画面と、更新後の390×844・1024×844を比較した。
- 写真、白縁、影が同じ非対称カーブに沿い、単純な角丸長方形ではないことを確認した。
- 390pxで主要人物の顔と手元、見出し、CTAが欠けず、横あふれがないことを確認した。
- 1024pxで右カラム内に収まり、左側コピーやCTAへ重ならないことを確認した。
- 写真アセット、代替テキスト、CTA、認証分岐は変更していない。
```

- [ ] **Step 5: 完了ゲートを実行する**

Run:

```bash
cd app
npm test
npm run lint
npm run build
npx playwright test e2e/guards.spec.ts
cd ..
git diff --check
git status --short
```

Expected:

```text
- 全UT PASS
- lint exit 0
- build exit 0
- guards E2E 30/30 PASS
- git diff --check exit 0
- task変更以外は既存の .codex/config.toml と .superpowers/ のみ
```

- [ ] **Step 6: QA証跡をコミットする**

```bash
git add docs/design/lp-mobile-reference/design-qa.md \
  docs/design/lp-mobile-reference/qa/implementation-hero-organic-390x844.png \
  docs/design/lp-mobile-reference/qa/implementation-hero-organic-1024x844.png
git commit -m "docs: ヒーロー有機フレームのQA結果を記録"
```
