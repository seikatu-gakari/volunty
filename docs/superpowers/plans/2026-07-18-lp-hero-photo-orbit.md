# LP Hero Photo Orbit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未ログインLPのヒーローへ、既存の実写真5枚を大きさと形を変えて散りばめたPhoto Orbit構成を追加する。

**Architecture:** 写真群を静的なServer Component `HeroPhotoOrbit` へ分離し、既存 `lpAssets` のメイン1枚とサブ4枚を決定的なレスポンシブ座標で配置する。`LPHeroSection` はコピーと導線を保ったまま、モバイルDOM順をコピー→CTA→写真群→安心情報へ変更し、既存E2EとDesign QAで画像読み込み・横あふれ・視覚差分を検証する。

**Tech Stack:** Next.js 16、React 19、TypeScript、Tailwind CSS 4、Vitest、Testing Library、Playwright、Codex in-app Browser

## Global Constraints

- 選択モックは `docs/design/lp-mobile-reference/concepts/photo-orbit-selected.png`。
- 使用画像は `heroCleanup`、`styleMediator`、`styleExplorer`、`benefitThanks`、`voiceOrganization` の5枚に限定する。
- 新しい写真、CSSで描く色玉・線・グラデーション、アニメーション、ランダム配置は追加しない。
- 日本語コピー、CTAの文言・リンク先・配色、ヘッダー、認証分岐、後続セクションは変更しない。
- モバイルDOM順はラベル・見出し・説明文→CTA→Photo Orbit→安心情報とする。
- メイン写真だけ `priority` を維持し、4枚のサブ写真は遅延読み込みにする。
- 1024pxでモバイル配置からデスクトップ配置へ切り替える。
- `.codex/config.toml` と `.superpowers/` は変更・コミットしない。

---

## File Map

- `app/src/app/components/lp/HeroPhotoOrbit.tsx`: 5枚の既存写真を静的な軌道配置で描画するServer Component。
- `app/src/app/components/lp/HeroPhotoOrbit.test.tsx`: 画像、alt、優先読み込み、輪郭クラスを検証する。
- `app/src/app/components/lp/LPHeroSection.tsx`: Photo Orbitを組み込み、モバイルDOM順とデスクトップグリッドを維持する。
- `app/src/app/components/lp/LPHeroSection.test.tsx`: CTA・Photo Orbit・安心情報のDOM順と既存導線を検証する。
- `app/e2e/guards.spec.ts`: LP画像総数21枚、Photo Orbit内5枚、モバイルCTA位置、横あふれを検証する。
- `docs/design/lp-mobile-reference/qa/implementation-hero-photo-orbit-390x844.png`: 390px実装画面。
- `docs/design/lp-mobile-reference/qa/implementation-hero-photo-orbit-1024x844.png`: 1024px実装画面。
- `docs/design/lp-mobile-reference/qa/compare-photo-orbit-390x844.png`: 選択モックと390px実装の左右比較。
- `docs/design/lp-mobile-reference/design-qa.md`: Photo Orbitの比較結果と最終判定。

---

### Task 1: HeroPhotoOrbitをTDDで追加する

**Files:**
- Create: `app/src/app/components/lp/HeroPhotoOrbit.test.tsx`
- Create: `app/src/app/components/lp/HeroPhotoOrbit.tsx`

**Interfaces:**
- Consumes: `lpAssets.heroCleanup`、`styleMediator`、`styleExplorer`、`benefitThanks`、`voiceOrganization`。
- Produces: propsを持たないServer Component `export function HeroPhotoOrbit(): ReactElement`。ルートに `data-testid="lp-hero-photo-orbit"`、5枚の `next/image` を持つ。

- [ ] **Step 1: 失敗するコンポーネントテストを書く**

`HeroPhotoOrbit.test.tsx` を次の内容で作成する。

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroPhotoOrbit } from "./HeroPhotoOrbit";

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    priority,
    src,
  }: {
    alt: string;
    className?: string;
    priority?: boolean;
    src: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      data-priority={priority ? "true" : "false"}
      src={src}
    />
  ),
}));

describe("HeroPhotoOrbit", () => {
  it("5つの活動写真を異なる大きさで表示する", () => {
    render(<HeroPhotoOrbit />);

    const orbit = screen.getByTestId("lp-hero-photo-orbit");
    expect(orbit.className).toContain("aspect-square");

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(5);
    expect(images.map((image) => image.getAttribute("alt"))).toEqual([
      "公園で清掃ボランティアに参加する若者たち",
      "地域イベントで受付を支えるボランティア",
      "自然保全活動へ向かうボランティア",
      "子どもから感謝のカードを受け取るボランティア",
      "地域活動について相談するNPOスタッフ",
    ]);
  });

  it("メイン写真だけを優先読み込みし有機的な輪郭を維持する", () => {
    render(<HeroPhotoOrbit />);

    const mainImage = screen.getByRole("img", {
      name: "公園で清掃ボランティアに参加する若者たち",
    });
    expect(mainImage.getAttribute("data-priority")).toBe("true");
    expect(mainImage.className).toContain(
      "rounded-[42%_58%_46%_54%/24%_32%_68%_76%]",
    );

    for (const image of screen.getAllByRole("img").slice(1)) {
      expect(image.getAttribute("data-priority")).toBe("false");
    }
  });
});
```

- [ ] **Step 2: テストを実行してREDを確認する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/HeroPhotoOrbit.test.tsx
```

Expected: `./HeroPhotoOrbit` が存在しないためFAILする。

- [ ] **Step 3: 最小のHeroPhotoOrbitを実装する**

`HeroPhotoOrbit.tsx` を次の内容で作成する。

```tsx
import Image from "next/image";
import { lpAssets } from "./lpAssets";

const SATELLITE_PHOTOS = [
  {
    key: "event",
    image: lpAssets.styleMediator,
    frameClassName:
      "absolute right-[1%] top-[1%] z-20 aspect-square w-[28%] overflow-hidden rounded-full border-[5px] border-white shadow-lg lg:right-0 lg:top-[2%] lg:w-[29%]",
    objectPosition: "50% 44%",
  },
  {
    key: "nature",
    image: lpAssets.styleExplorer,
    frameClassName:
      "absolute right-0 top-[34%] z-20 aspect-[4/5] w-[31%] overflow-hidden rounded-[48%_52%_45%_55%/42%_47%_53%_58%] border-[5px] border-white shadow-lg lg:right-[1%] lg:top-[34%] lg:w-[30%]",
    objectPosition: "50% 45%",
  },
  {
    key: "thanks",
    image: lpAssets.benefitThanks,
    frameClassName:
      "absolute bottom-[1%] left-[1%] z-20 aspect-square w-[27%] overflow-hidden rounded-full border-[5px] border-white shadow-lg lg:bottom-[2%] lg:left-[2%] lg:w-[28%]",
    objectPosition: "50% 44%",
  },
  {
    key: "organization",
    image: lpAssets.voiceOrganization,
    frameClassName:
      "absolute right-[4%] bottom-0 z-20 aspect-[5/4] w-[29%] overflow-hidden rounded-[52%_48%_55%_45%/46%_54%_46%_54%] border-[5px] border-white shadow-lg lg:right-[3%] lg:bottom-[1%] lg:w-[30%]",
    objectPosition: "50% 48%",
  },
] as const;

export function HeroPhotoOrbit() {
  const main = lpAssets.heroCleanup;

  return (
    <div
      data-testid="lp-hero-photo-orbit"
      className="relative mx-auto aspect-square w-full max-w-xl lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:max-w-none"
    >
      <div className="absolute top-[17%] left-[8%] z-10 w-[84%] overflow-hidden rounded-[42%_58%_46%_54%/24%_32%_68%_76%] bg-white p-1.5 shadow-xl ring-1 ring-card-border lg:top-[17%] lg:left-[7%] lg:w-[76%] lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]">
        <Image
          alt={main.alt}
          className="aspect-[4/3] w-full rounded-[42%_58%_46%_54%/24%_32%_68%_76%] object-cover lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]"
          height={main.height}
          priority
          sizes="(min-width: 1024px) 42vw, 84vw"
          src={main.src}
          style={{ objectPosition: main.objectPosition }}
          width={main.width}
        />
      </div>

      {SATELLITE_PHOTOS.map((photo) => (
        <div key={photo.key} className={photo.frameClassName}>
          <Image
            alt={photo.image.alt}
            className="h-full w-full object-cover"
            height={photo.image.height}
            sizes="(min-width: 1024px) 17vw, 31vw"
            src={photo.image.src}
            style={{ objectPosition: photo.objectPosition }}
            width={photo.image.width}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 対象テストを実行してGREENを確認する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/HeroPhotoOrbit.test.tsx
```

Expected: `1 file passed`、`2 tests passed`。

- [ ] **Step 5: lintと差分を確認する**

Run:

```bash
cd app && npx eslint src/app/components/lp/HeroPhotoOrbit.tsx src/app/components/lp/HeroPhotoOrbit.test.tsx
cd .. && git diff --check -- app/src/app/components/lp/HeroPhotoOrbit.tsx app/src/app/components/lp/HeroPhotoOrbit.test.tsx
```

Expected: 両コマンドが終了コード0。

- [ ] **Step 6: Task 1をコミットする**

```bash
git add app/src/app/components/lp/HeroPhotoOrbit.tsx app/src/app/components/lp/HeroPhotoOrbit.test.tsx
git commit -m "feat: ヒーローへPhoto Orbit写真群を追加"
```

---

### Task 2: Photo OrbitをLPへ統合してE2E契約を更新する

**Files:**
- Modify: `app/src/app/components/lp/LPHeroSection.test.tsx`
- Modify: `app/e2e/guards.spec.ts`
- Modify: `app/src/app/components/lp/LPHeroSection.tsx`

**Interfaces:**
- Consumes: Task 1の `HeroPhotoOrbit`。
- Produces: モバイルDOM順がコピー→CTA→Photo Orbit→安心情報となり、デスクトップではPhoto Orbitが右カラム3行を占有する `LPHeroSection`。

- [ ] **Step 1: 統合の失敗テストを追加する**

`LPHeroSection.test.tsx` の2件目テスト末尾へ次を追加する。

```tsx
const orbit = screen.getByTestId("lp-hero-photo-orbit");
const trustItem = screen.getByText("登録・診断は無料");

expect(
  primaryCTA.compareDocumentPosition(orbit) & Node.DOCUMENT_POSITION_FOLLOWING,
).not.toBe(0);
expect(
  orbit.compareDocumentPosition(trustItem) & Node.DOCUMENT_POSITION_FOLLOWING,
).not.toBe(0);
expect(screen.getAllByRole("img")).toHaveLength(5);
```

`guards.spec.ts` の画像契約を次へ変更する。

```ts
const images = page.locator("main img");
await expect(images).toHaveCount(21);

const photoOrbit = page.getByTestId("lp-hero-photo-orbit");
await expect(photoOrbit.locator("img")).toHaveCount(5);
```

モバイルテストの `await expectLandingPageIntegrity(page, 390);` の直後へ次を追加する。

```ts
const primaryCTA = page.getByRole("link", { name: "無料で簡易診断を試す" }).first();
const photoOrbit = page.getByTestId("lp-hero-photo-orbit");
const [ctaBox, orbitBox] = await Promise.all([
  primaryCTA.boundingBox(),
  photoOrbit.boundingBox(),
]);
expect(ctaBox).not.toBeNull();
expect(orbitBox).not.toBeNull();
expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(orbitBox!.y + 1);
```

- [ ] **Step 2: 対象UTとモバイルE2Eを実行してREDを確認する**

Run:

```bash
cd app
npx vitest run src/app/components/lp/LPHeroSection.test.tsx
npx playwright test e2e/guards.spec.ts --grep "主要コンテンツと操作導線"
```

Expected:

```text
- UT: `lp-hero-photo-orbit` が存在しないためFAIL
- E2E: main画像が17枚のまま、またはPhoto Orbitが存在しないためFAIL
```

- [ ] **Step 3: LPHeroSectionへPhoto Orbitを統合する**

`LPHeroSection.tsx` の `Image` と `lpAssets` import、および `const hero` を削除し、次を追加する。

```tsx
import { HeroPhotoOrbit } from "./HeroPhotoOrbit";
```

見出し・説明文のブロック直後にCTAブロックを置き、その次へ次を配置する。

```tsx
<HeroPhotoOrbit />
```

既存の単一画像ラッパー全体を削除する。安心情報ブロックは `HeroPhotoOrbit` の後に置く。CTAブロックと安心情報ブロックのクラスは変更しない。

最終的なグリッド直下の順序を次にする。

```tsx
<div className="relative z-10 lg:col-start-1 lg:row-start-1">...</div>
<div className="grid gap-3 sm:grid-cols-2 lg:col-start-1 lg:row-start-2">...</div>
<HeroPhotoOrbit />
<div className="grid grid-cols-3 ... lg:col-start-1 lg:row-start-3">...</div>
```

- [ ] **Step 4: 対象UTとモバイルE2Eを実行してGREENを確認する**

Run:

```bash
cd app
npx vitest run src/app/components/lp/HeroPhotoOrbit.test.tsx src/app/components/lp/LPHeroSection.test.tsx
npx playwright test e2e/guards.spec.ts --grep "主要コンテンツと操作導線"
```

Expected: 対象UT `2 files passed`、モバイルE2EとsetupがPASS。

- [ ] **Step 5: lintと差分を確認する**

Run:

```bash
cd app && npx eslint src/app/components/lp/LPHeroSection.tsx src/app/components/lp/LPHeroSection.test.tsx e2e/guards.spec.ts
cd .. && git diff --check -- app/src/app/components/lp/LPHeroSection.tsx app/src/app/components/lp/LPHeroSection.test.tsx app/e2e/guards.spec.ts
```

Expected: 両コマンドが終了コード0。

- [ ] **Step 6: Task 2をコミットする**

```bash
git add app/src/app/components/lp/LPHeroSection.tsx \
  app/src/app/components/lp/LPHeroSection.test.tsx \
  app/e2e/guards.spec.ts
git commit -m "feat: Photo Orbitを未ログインLPへ統合"
```

---

### Task 3: Photo Orbitの実画面QAと完了ゲートを通す

**Files:**
- Create: `docs/design/lp-mobile-reference/qa/implementation-hero-photo-orbit-390x844.png`
- Create: `docs/design/lp-mobile-reference/qa/implementation-hero-photo-orbit-1024x844.png`
- Create: `docs/design/lp-mobile-reference/qa/compare-photo-orbit-390x844.png`
- Modify: `docs/design/lp-mobile-reference/design-qa.md`

**Interfaces:**
- Consumes: Task 2の未ログインLP、選択モック `docs/design/lp-mobile-reference/concepts/photo-orbit-selected.png`。
- Produces: 390px・1024pxの実装証跡、選択モックとの左右比較、`final result: passed` のQA記録。

- [ ] **Step 1: ローカルLPの応答を確認する**

Run:

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/
```

Expected: `HTTP 200`。

- [ ] **Step 2: 390 × 844をin-app Browserで撮影・検査する**

Codex in-app Browserの既存 `http://localhost:3000/` タブを使い、390 × 844で次を確認し、`implementation-hero-photo-orbit-390x844.png` を保存する。

```text
- 見出しと説明文の後、2つのCTAがPhoto Orbitより先に表示される
- Photo Orbit内にメイン1枚・サブ4枚が表示される
- 写真の顔と活動内容がCTAや画面端で欠けない
- 5枚の白縁が不自然に太くならず、写真同士の重なりが制御されている
- document.documentElement.scrollWidth === 390
- main内の21画像がcomplete && naturalWidth > 0
- console errorが0件
```

- [ ] **Step 3: 1024 × 844をin-app Browserで撮影・検査する**

1024 × 844へ切り替えて `implementation-hero-photo-orbit-1024x844.png` を保存する。

```text
- 左カラムにコピー・CTA・安心情報、右カラムにPhoto Orbitが収まる
- Photo Orbitがヘッダーや左カラムへ重ならない
- 5枚すべての顔と活動内容が識別できる
- 横方向のオーバーフローがない
- 公開ヘッダーがデスクトップ表示へ切り替わる
```

- [ ] **Step 4: 選択モックと実装を比較する**

選択モックを390 × 844へ縮小し、更新後390 × 844を右へ並べた780 × 844 RGB PNG `compare-photo-orbit-390x844.png` を作る。生成や装飾を加えず、左右へ機械連結する。

比較で次を確認する。

```text
- 1枚のメイン写真と4枚のサブ写真による密度差
- 円形と有機的な楕円の混在
- クリーム背景の余白
- CTAが写真群より前にあること
- オレンジ、ティール、黄色、紫のBalanced Popを維持していること
```

- [ ] **Step 5: Design QA記録を更新する**

`design-qa.md` の `final result: passed` の直前へ次を追記する。

```markdown
## 2026-07-18 Photo Orbit更新

- 選択モック `concepts/photo-orbit-selected.png` と実装390×844を左右比較した。
- 既存写真5枚をメイン1枚・サブ4枚の非対称配置で表示し、単一写真だけの寂しさを解消した。
- モバイルではCTA→Photo Orbit→安心情報のDOM順、デスクトップでは左コピー／右Photo Orbitの構成を確認した。
- 390px・1024pxで写真の顔、白縁、重なり、横あふれ、画像読み込み、console errorを確認した。
- 日本語コピー、CTA、ヘッダー、認証分岐、後続セクションは変更していない。
```

- [ ] **Step 6: 全完了ゲートを実行する**

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

- [ ] **Step 7: QA証跡をコミットする**

```bash
git add docs/design/lp-mobile-reference/design-qa.md \
  docs/design/lp-mobile-reference/qa/implementation-hero-photo-orbit-390x844.png \
  docs/design/lp-mobile-reference/qa/implementation-hero-photo-orbit-1024x844.png \
  docs/design/lp-mobile-reference/qa/compare-photo-orbit-390x844.png
git commit -m "docs: Photo OrbitヒーローのQA結果を記録"
```
