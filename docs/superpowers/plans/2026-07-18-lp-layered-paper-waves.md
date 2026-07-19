# 未ログインLP Layered Paper Waves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 選択済みのスマホ・PCモックを基準に、未ログインLP全体へ実画像の紙レイヤー背景を追加し、写真がない区間の余白を意図のあるPOPな余白へ変える。

**Architecture:** 6枚の透過WebP（上端、縦レール、区切りのモバイル・PCペア）を生成し、Server Component `LPPaperStage` が4つの静的variantで再利用する。`page.tsx`で既存セクションを4ステージへグループ化し、既存のコピー、写真、CTA、アンカー、認証分岐、Reveal動作は維持する。

**Tech Stack:** Next.js 16 App Router、React 19 Server Components、TypeScript strict、Tailwind CSS 4、Vitest + Testing Library、Playwright、built-in ImageGen、`remove_chroma_key.py`、`cwebp`、in-app Browser。

## Global Constraints

- 選択モックは `docs/design/lp-mobile-reference/concepts/layered-paper-waves-mobile-selected.png` と `docs/design/lp-mobile-reference/concepts/layered-paper-waves-desktop-selected.png` を唯一のビジュアル基準にする。
- 日本語コピー、「ボランティー」表記、CTA文言・リンク先・配色、Header、モバイルメニュー、FAQ、認証分岐を変更しない。
- LPのセクション順、アンカーID、Photo Orbitの5枚構成、1024pxの公開ヘッダー切替境界を変更しない。
- CSS図形、`clip-path`、疑似要素アート、手書きSVG、グラデーション、ガラス表現、絵文字を追加しない。
- 紙レイヤーは実画像アセットを使い、装飾DOMは`aria-hidden`かつ`pointer-events: none`にする。
- 新しいClient Component、ランダム座標、スクロール連動、視差、自動再生、点滅を追加しない。
- 既存のLPカラートークンを使い、色値をTypeScriptまたはCSSへ新しくハードコードしない。
- 同一ブレークポイントで利用する6アセットのうち実際に読み込む3枚は、各200KB以下、合計600KB以下を目標にする。6枚全体は1.2MB以下とする。
- ユーザー所有の `.codex/config.toml` と `.superpowers/` は変更・stage・commitしない。

---

## File Map

### Create

- `app/public/images/lp/paper-waves/crown-mobile.webp` — モバイルのステージ上端に使う透過紙レイヤー。
- `app/public/images/lp/paper-waves/crown-desktop.webp` — PCのステージ上端に使う透過紙レイヤー。
- `app/public/images/lp/paper-waves/rail-mobile.webp` — モバイルで縦方向に繰り返す左右端の透過紙レイヤー。
- `app/public/images/lp/paper-waves/rail-desktop.webp` — PCで縦方向に繰り返す左右端の透過紙レイヤー。
- `app/public/images/lp/paper-waves/divider-mobile.webp` — モバイルのステージ下端に使う透過紙レイヤー。
- `app/public/images/lp/paper-waves/divider-desktop.webp` — PCのステージ下端に使う透過紙レイヤー。
- `app/src/app/components/lp/LPPaperStage.tsx` — 4variantの紙背景と子セクションを合成するServer Component。
- `app/src/app/components/lp/LPPaperStage.test.tsx` — variant、装飾の非操作性、子要素描画を検証するUT。
- `docs/design/lp-mobile-reference/paper-waves-design-qa.md` — 選択モックと実装の比較結果、操作確認、完了ゲートを記録する。

### Modify

- `app/src/app/globals.css:123-130` — 実画像を組み合わせる紙ステージ用CSSを追加する。
- `app/src/app/page.tsx:84-135` — 未ログインLPを4つの`LPPaperStage`へグループ化する。
- `app/src/app/components/lp/LPHeroSection.tsx:13` — 全面クリーム背景を紙ステージへ委譲する。
- `app/src/app/components/lp/DiagnosisTypesCarousel.tsx:52` — 全面イエロー背景を紙ステージへ委譲する。
- `app/src/app/components/lp/UsageSection.tsx:43` — 全面ティール背景を紙ステージへ委譲する。
- `app/src/app/components/lp/BenefitsSection.tsx:31-34` — 全面パープル背景を紙ステージへ委譲する。
- `app/src/app/components/lp/VoicesSection.tsx:33` — 全面ティール背景を紙ステージへ委譲する。
- `app/e2e/guards.spec.ts:15-77, 183-204` — 4ステージ、横あふれ、認証後非表示を検証する。
- `docs/design/lp-mobile-reference/qa/` — 4幅の実装キャプチャとスマホ・PC比較画像を追加する。

---

### Task 1: 紙レイヤー実画像アセットを生成する

**Files:**
- Create: `app/public/images/lp/paper-waves/crown-mobile.webp`
- Create: `app/public/images/lp/paper-waves/crown-desktop.webp`
- Create: `app/public/images/lp/paper-waves/rail-mobile.webp`
- Create: `app/public/images/lp/paper-waves/rail-desktop.webp`
- Create: `app/public/images/lp/paper-waves/divider-mobile.webp`
- Create: `app/public/images/lp/paper-waves/divider-desktop.webp`

**Interfaces:**
- Consumes: 選択モック2枚、既存色`#fb5b01`、`#12a4a1`、`#f6c644`、`#9370db`、クロマキー`#ff00ff`。
- Produces: `globals.css`から参照する6つの透過WebPパス。

- [ ] **Step 1: 出力ディレクトリを作成する**

Run:

```bash
mkdir -p app/public/images/lp/paper-waves tmp/imagegen/paper-waves
```

Expected: 両ディレクトリが存在し、既存ファイルを上書きしていない。

- [ ] **Step 2: 上端アセットのモバイル・PCペアをImageGenで生成する**

モバイルは`layered-paper-waves-mobile-selected.png`、PCは`layered-paper-waves-desktop-selected.png`を実画像参照としてbuilt-in ImageGenへ添付する。各出力は独立したImageGen callにする。

Mobile prompt:

```text
Use case: stylized-concept
Asset type: responsive website background asset
Target dimensions: 960 x 480 landscape
Primary request: Create only the upper crown of the approved Layered Paper Waves design for the Japanese volunteer matching landing page. Three broad tactile cut-paper layers enter from the top and side edges: deep coral #fb5b01, deep teal #12a4a1, and warm yellow #f6c644. Match the selected mobile mock's smooth scalloped curves and subtle real paper fiber. Keep the lower 45 percent completely empty for page content.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for removal.
Constraints: one coherent asset, crisp antialiased paper edges, no text, no logo, no photography, no shadows beyond a very subtle paper-edge lift, no gradients, no glass, no white or cream background, no #ff00ff in the artwork, no watermark.
```

Desktop prompt:

```text
Use case: stylized-concept
Asset type: responsive website background asset
Target dimensions: 1920 x 420 landscape
Primary request: Create the desktop counterpart of the approved Layered Paper Waves upper crown. Broad tactile cut-paper layers enter from the top-left and top-right edges using deep coral #fb5b01, deep teal #12a4a1, and warm yellow #f6c644. Match the selected desktop mock's shallow wide curves and subtle real paper fiber. Keep the center and lower 55 percent completely empty for the two-column hero.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for removal.
Constraints: one coherent asset, crisp antialiased paper edges, no text, no logo, no photography, no shadows beyond a very subtle paper-edge lift, no gradients, no glass, no white or cream background, no #ff00ff in the artwork, no watermark.
```

Expected: 2枚とも紙レイヤーだけがあり、中央の読み取り領域がクロマキーで空いている。

- [ ] **Step 3: 縦レールアセットのモバイル・PCペアをImageGenで生成する**

Mobile prompt:

```text
Use case: stylized-concept
Asset type: seamless vertical website background tile
Target dimensions: 960 x 960 square
Primary request: Create a vertically seamless side-rail tile for the approved Layered Paper Waves mobile landing page. Tactile cut-paper waves appear only along the far left and far right edges using deep teal #12a4a1, warm yellow #f6c644, deep coral #fb5b01, and a short restrained purple #9370db accent. Keep the central 70 percent empty. The top and bottom edge geometry must align exactly so the image can repeat vertically without a seam.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for removal.
Constraints: seamless vertical tile, no text, no logo, no photography, no gradients, no glass, no dense confetti, no white or cream background, no #ff00ff in the artwork, no watermark.
```

Desktop prompt:

```text
Use case: stylized-concept
Asset type: seamless vertical website background tile
Target dimensions: 1920 x 900 landscape
Primary request: Create the desktop counterpart of the approved Layered Paper Waves side rail. Tactile cut-paper waves stay within the outer 18 percent of the left and right edges using deep teal #12a4a1, warm yellow #f6c644, deep coral #fb5b01, and a short restrained purple #9370db accent. Keep the central 64 percent empty for the max-width content. The top and bottom edge geometry must align exactly for seamless vertical repetition.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for removal.
Constraints: seamless vertical tile, no text, no logo, no photography, no gradients, no glass, no dense confetti, no white or cream background, no #ff00ff in the artwork, no watermark.
```

Expected: 中央が空き、上下端を並べても波形と紙色が途切れない。

- [ ] **Step 4: 区切りアセットのモバイル・PCペアをImageGenで生成する**

Mobile prompt:

```text
Use case: stylized-concept
Asset type: responsive website section divider
Target dimensions: 960 x 360 landscape
Primary request: Create the lower section divider for the approved Layered Paper Waves mobile landing page. A broad warm yellow #f6c644 paper wave crosses the bottom, a deep teal #12a4a1 layer rises behind it from the left, and a restrained purple #9370db layer appears briefly at the right edge. Match the selected mobile mock's flowing paper valley and subtle real paper texture. Keep the upper 45 percent empty.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for removal.
Constraints: no text, no logo, no photography, no gradients, no glass, no dense dots or rings, no white or cream background, no #ff00ff in the artwork, no watermark.
```

Desktop prompt:

```text
Use case: stylized-concept
Asset type: responsive website section divider
Target dimensions: 1920 x 320 landscape
Primary request: Create the wide desktop counterpart of the approved Layered Paper Waves lower divider. A broad warm yellow #f6c644 paper wave crosses the bottom, a deep teal #12a4a1 layer enters from the left, and a restrained purple #9370db layer appears briefly at the right edge. Match the selected desktop mock's shallow wide curves and subtle paper fiber. Keep the upper 55 percent empty for content breathing room.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for removal.
Constraints: no text, no logo, no photography, no gradients, no glass, no dense dots or rings, no white or cream background, no #ff00ff in the artwork, no watermark.
```

Expected: 2枚とも、黄色を主役にした下端の紙波だけが表示される。

- [ ] **Step 5: 6枚のクロマキーを透過化し、規定寸法のWebPへ変換する**

各ImageGen tool resultが返した絶対パスを、そのアセットの`SOURCE_PATH`環境変数へ設定してから実行する。次は`crown-mobile`の例であり、残り5枚も表の寸法と同じコマンド形で実行する。

```bash
test -f "${SOURCE_PATH:?ImageGen result path is required}"
python "$HOME/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input "$SOURCE_PATH" \
  --out tmp/imagegen/paper-waves/crown-mobile-alpha.png \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
ffmpeg -y -i tmp/imagegen/paper-waves/crown-mobile-alpha.png \
  -vf "scale=960:480:force_original_aspect_ratio=increase,crop=960:480" \
  tmp/imagegen/paper-waves/crown-mobile-sized.png
cwebp -quiet -q 76 -m 6 \
  tmp/imagegen/paper-waves/crown-mobile-sized.png \
  -o app/public/images/lp/paper-waves/crown-mobile.webp
```

| basename | width | height |
| --- | ---: | ---: |
| `crown-mobile` | 960 | 480 |
| `crown-desktop` | 1920 | 420 |
| `rail-mobile` | 960 | 960 |
| `rail-desktop` | 1920 | 900 |
| `divider-mobile` | 960 | 360 |
| `divider-desktop` | 1920 | 320 |

Expected: `app/public/images/lp/paper-waves/`に6枚のWebPがあり、背景が透過している。

- [ ] **Step 6: アセット品質と容量を検証する**

Run:

```bash
for image in app/public/images/lp/paper-waves/*.webp; do
  file "$image"
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,pix_fmt \
    -of default=noprint_wrappers=1 "$image"
  wc -c "$image"
done
find app/public/images/lp/paper-waves -name '*.webp' -size +200k -print
```

Expected:

- 6枚すべてがWebP。
- `pix_fmt`にalphaを含む。
- 寸法が表と一致する。
- `find`は何も出力しない。200KBを超えた場合は`cwebp -q 70 -m 6`でそのファイルだけ再圧縮する。

- [ ] **Step 7: 選択モックと6アセットを目視確認する**

6枚を`view_image`で開き、次を確認する。

- 紙色が既存トークンとずれていない。
- 文字、ロゴ、人物、ハッカソン固有要素が含まれていない。
- クロマキーの紫縁が残っていない。
- railの上下を並べた時に継ぎ目が見えない。
- 紙質感が写真より強くない。

Expected: 6項目すべてを満たす。満たさない画像だけ、1回につき1点の修正指示で再生成する。

- [ ] **Step 8: アセットをcommitする**

```bash
git add app/public/images/lp/paper-waves/
git commit -m "feat: LP用の紙レイヤー背景を追加"
```

Expected: 6枚だけがcommitされ、`.codex/config.toml`と`.superpowers/`は含まれない。

---

### Task 2: `LPPaperStage`をTDDで追加する

**Files:**
- Create: `app/src/app/components/lp/LPPaperStage.test.tsx`
- Create: `app/src/app/components/lp/LPPaperStage.tsx`
- Modify: `app/src/app/globals.css:123-130`

**Interfaces:**
- Consumes: Task 1の6アセット。
- Produces: `PaperStageVariant`型と`LPPaperStage({ variant, children })` Server Component。

- [ ] **Step 1: 失敗するUTを書く**

Create `app/src/app/components/lp/LPPaperStage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPPaperStage } from "./LPPaperStage";

const VARIANTS = ["hero", "journey", "styles", "trust"] as const;

describe("LPPaperStage", () => {
  it.each(VARIANTS)("%s variantの背景と子要素を描画する", (variant) => {
    render(
      <LPPaperStage variant={variant}>
        <p>{variant} content</p>
      </LPPaperStage>,
    );

    const stage = screen.getByTestId("lp-paper-stage");
    const backdrop = screen.getByTestId("lp-paper-backdrop");

    expect(stage.getAttribute("data-variant")).toBe(variant);
    expect(stage.className).toContain("bg-lp-cream");
    expect(backdrop.className).toContain(`lp-paper-stage--${variant}`);
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop.className).toContain("pointer-events-none");
    expect(screen.getByText(`${variant} content`)).toBeDefined();
  });
});
```

- [ ] **Step 2: UTが期待どおりREDになることを確認する**

Run:

```bash
cd app && npx vitest run src/app/components/lp/LPPaperStage.test.tsx
```

Expected: FAIL with `Failed to resolve import "./LPPaperStage"` or equivalent module-not-found message.

- [ ] **Step 3: 最小のServer Componentを実装する**

Create `app/src/app/components/lp/LPPaperStage.tsx`:

```tsx
import type { ReactNode } from "react";

export type PaperStageVariant = "hero" | "journey" | "styles" | "trust";

const BACKDROP_CLASS_NAMES: Record<PaperStageVariant, string> = {
  hero: "lp-paper-stage--hero",
  journey: "lp-paper-stage--journey",
  styles: "lp-paper-stage--styles",
  trust: "lp-paper-stage--trust",
};

interface LPPaperStageProps {
  variant: PaperStageVariant;
  children: ReactNode;
}

export function LPPaperStage({ variant, children }: LPPaperStageProps) {
  return (
    <div
      className="relative isolate overflow-hidden bg-lp-cream"
      data-testid="lp-paper-stage"
      data-variant={variant}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 lp-paper-stage__backdrop ${BACKDROP_CLASS_NAMES[variant]}`}
        data-testid="lp-paper-backdrop"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: 実画像だけで背景を合成するCSSを書く**

Append to `app/src/app/globals.css`:

```css
/* 未ログインLP: Layered Paper Waves */
.lp-paper-stage__backdrop {
  background-repeat: no-repeat, repeat-y, no-repeat;
  background-position: top center, center top, bottom center;
  background-size: 100% auto, 100% auto, 100% auto;
}

.lp-paper-stage--hero {
  background-image:
    url("/images/lp/paper-waves/crown-mobile.webp"),
    url("/images/lp/paper-waves/rail-mobile.webp"),
    url("/images/lp/paper-waves/divider-mobile.webp");
}

.lp-paper-stage--journey {
  background-image:
    url("/images/lp/paper-waves/crown-mobile.webp"),
    url("/images/lp/paper-waves/rail-mobile.webp"),
    url("/images/lp/paper-waves/divider-mobile.webp");
  background-position: top left, right top, bottom right;
}

.lp-paper-stage--styles {
  background-image:
    url("/images/lp/paper-waves/crown-mobile.webp"),
    url("/images/lp/paper-waves/rail-mobile.webp"),
    url("/images/lp/paper-waves/divider-mobile.webp");
  background-position: top right, left top, bottom left;
}

.lp-paper-stage--trust {
  background-image:
    url("/images/lp/paper-waves/crown-mobile.webp"),
    url("/images/lp/paper-waves/rail-mobile.webp"),
    url("/images/lp/paper-waves/divider-mobile.webp");
  background-position: top center, right top, bottom center;
}

@media (min-width: 1024px) {
  .lp-paper-stage--hero,
  .lp-paper-stage--journey,
  .lp-paper-stage--styles,
  .lp-paper-stage--trust {
    background-image:
      url("/images/lp/paper-waves/crown-desktop.webp"),
      url("/images/lp/paper-waves/rail-desktop.webp"),
      url("/images/lp/paper-waves/divider-desktop.webp");
  }
}
```

Do not add CSS masks, `clip-path`, gradients, pseudo-elements, or hard-coded fallback colors.

- [ ] **Step 5: UTをGREENにする**

Run:

```bash
cd app && npx vitest run src/app/components/lp/LPPaperStage.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 6: lintとdiffを確認する**

Run:

```bash
cd app && npm run lint -- src/app/components/lp/LPPaperStage.tsx src/app/components/lp/LPPaperStage.test.tsx
cd .. && git diff --check
```

Expected: exit 0。`"use client"`、`any`、インライン色値が追加されていない。

- [ ] **Step 7: componentとCSSをcommitする**

```bash
git add app/src/app/components/lp/LPPaperStage.tsx \
  app/src/app/components/lp/LPPaperStage.test.tsx \
  app/src/app/globals.css
git commit -m "feat: LPへ紙レイヤーステージを追加"
```

---

### Task 3: 未ログインLPを4ステージへ統合する

**Files:**
- Modify: `app/e2e/guards.spec.ts:15-77, 183-204`
- Modify: `app/src/app/page.tsx:84-135`
- Modify: `app/src/app/components/lp/LPHeroSection.tsx:13`
- Modify: `app/src/app/components/lp/DiagnosisTypesCarousel.tsx:52`
- Modify: `app/src/app/components/lp/UsageSection.tsx:43`
- Modify: `app/src/app/components/lp/BenefitsSection.tsx:31-34`
- Modify: `app/src/app/components/lp/VoicesSection.tsx:33`
- Test: `app/src/app/components/lp/LPPaperStage.test.tsx`
- Test: `app/e2e/guards.spec.ts`

**Interfaces:**
- Consumes: `LPPaperStage`と4つの`PaperStageVariant`。
- Produces: 未ログイン時だけ4ステージを表示するLP構造。

- [ ] **Step 1: 4ステージを要求するE2E assertionを先に書く**

In `expectLandingPageIntegrity`, hero locatorをnested stage対応へ変更し、`sections`構築直後へ次を追加する。

```ts
const paperStages = page.getByTestId("lp-paper-stage");
await expect(paperStages).toHaveCount(4);
for (const [index, variant] of ["hero", "journey", "styles", "trust"].entries()) {
  await expect(paperStages.nth(index)).toHaveAttribute("data-variant", variant);
  await expect(paperStages.nth(index).getByTestId("lp-paper-backdrop")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
}
```

Replace:

```ts
{ name: "hero", locator: page.locator("main > section").first() },
```

with:

```ts
{ name: "hero", locator: page.locator("main section").first() },
```

In the authenticated home test, add:

```ts
await expect(page.getByTestId("lp-paper-stage")).toHaveCount(0);
```

Add a separate unauthenticated fallback test. It must abort only the six generated background requests and prove that essential content and interaction remain available on the cream base:

```ts
test("紙背景の取得失敗時も主要情報と操作を維持する", async ({ page }) => {
  await page.route("**/images/lp/paper-waves/*.webp", async (route) => {
    await route.abort();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /無料で簡易診断を試す/ })).toHaveAttribute(
    "href",
    "/diagnosis/trial",
  );
  await expect(page.getByRole("link", { name: /活動を探す/ }).first()).toHaveAttribute(
    "href",
    "/opportunities",
  );
  await expect(page.getByTestId("lp-paper-stage")).toHaveCount(4);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
```

- [ ] **Step 2: E2Eが期待どおりREDになることを確認する**

Run:

```bash
cd app && npx playwright test e2e/guards.spec.ts --project=chromium
```

Expected: 未ログインLPケースと背景取得失敗ケースが`Expected: 4, Received: 0`でFAILし、認証・DB・環境エラーではない。

- [ ] **Step 3: `page.tsx`を4ステージへグループ化する**

Add import:

```ts
import { LPPaperStage } from "./components/lp/LPPaperStage";
```

Replace the unauthenticated `<main>` contents with:

```tsx
<LPPaperStage variant="hero">
  <LPHeroSection />
  <Reveal>
    <DiagnosisTypesCarousel />
  </Reveal>
</LPPaperStage>

<LPPaperStage variant="journey">
  <Reveal>
    <PainPointsSection />
  </Reveal>
  <Reveal>
    <UsageSection />
  </Reveal>
</LPPaperStage>

<LPPaperStage variant="styles">
  <Reveal>
    <DiagnosisTypesGrid />
  </Reveal>
  <Reveal>
    <BenefitsSection />
  </Reveal>
</LPPaperStage>

<LPPaperStage variant="trust">
  <Reveal>
    <VoicesSection />
  </Reveal>
  <Reveal>
    <FeaturesSection />
  </Reveal>
  <Reveal>
    <FAQSection />
  </Reveal>
</LPPaperStage>

<Reveal>
  <LPBottomCTA />
</Reveal>
<LPFooter />
```

Keep the existing `<main className>` unchanged.

- [ ] **Step 4: 既存の全面背景だけを透明化する**

Apply these exact class changes and keep every other class unchanged:

```text
LPHeroSection:
- relative z-10 -mx-4 overflow-hidden bg-lp-cream px-4 ...
+ relative z-10 -mx-4 bg-transparent px-4 ...

DiagnosisTypesCarousel:
- relative -mx-4 bg-pop-yellow-soft/60 px-4 ... lg:rounded-[40px] ...
+ relative -mx-4 bg-transparent px-4 ...

UsageSection:
- rounded-[40px] bg-pop-teal-soft px-5 ...
+ bg-transparent px-5 ...

BenefitsSection:
- -mx-4 bg-pop-purple-soft/70 px-4 ... lg:rounded-[40px] ...
+ -mx-4 bg-transparent px-4 ...

VoicesSection:
- rounded-[40px] bg-pop-teal-soft px-5 ...
+ bg-transparent px-5 ...
```

Do not change card backgrounds, photo crops, button classes, section padding, IDs, headings, or `Reveal`.

- [ ] **Step 5: 対象UTを実行する**

Run:

```bash
cd app && npx vitest run \
  src/app/components/lp/LPPaperStage.test.tsx \
  src/app/components/lp/LPHeroSection.test.tsx \
  src/app/components/lp/DiagnosisTypesCarousel.test.tsx \
  src/app/components/lp/UsageSection.test.tsx \
  src/app/components/lp/BenefitsSection.test.tsx \
  src/app/components/lp/VoicesSection.test.tsx
```

Expected: all selected files PASS。既存のコピー、CTA、Photo Orbit、カード数assertionを変更しない。

- [ ] **Step 6: guards E2EをGREENにする**

Run:

```bash
cd app && npx playwright test e2e/guards.spec.ts --project=chromium
```

Expected:

- 未ログイン390px、768px、1440pxで4ステージを順番どおり表示する。
- 21枚のコンテンツ画像が読み込まれる。
- 横スクロールがない。
- モバイルメニュー、FAQ、CTAが動作する。
- 6背景画像をabortしても見出し、CTA、4ステージ、横幅が成立する。
- 認証済みホームの紙ステージ数は0。

- [ ] **Step 7: 統合変更をcommitする**

```bash
git add app/src/app/page.tsx \
  app/src/app/components/lp/LPHeroSection.tsx \
  app/src/app/components/lp/DiagnosisTypesCarousel.tsx \
  app/src/app/components/lp/UsageSection.tsx \
  app/src/app/components/lp/BenefitsSection.tsx \
  app/src/app/components/lp/VoicesSection.tsx \
  app/e2e/guards.spec.ts
git commit -m "feat: 未ログインLPへ紙レイヤー背景を統合"
```

---

### Task 4: 4幅でDesign QAを行い、選択モックへ合わせる

**Files:**
- Create: `docs/design/lp-mobile-reference/qa/implementation-paper-waves-390x844.png`
- Create: `docs/design/lp-mobile-reference/qa/implementation-paper-waves-768x1024.png`
- Create: `docs/design/lp-mobile-reference/qa/implementation-paper-waves-1024x844.png`
- Create: `docs/design/lp-mobile-reference/qa/implementation-paper-waves-1440x1024.png`
- Create: `docs/design/lp-mobile-reference/qa/compare-paper-waves-mobile.png`
- Create: `docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop.png`
- Create: `docs/design/lp-mobile-reference/paper-waves-design-qa.md`
- Modify when required by visual evidence: Task 2–3 files only。

**Interfaces:**
- Consumes: 選択モック2枚とlocalhost実装。
- Produces: 同一比率の比較画像、4幅のQA証跡、実測結果。

- [ ] **Step 1: localhostの稼働状態を確認する**

Run:

```bash
curl -I http://localhost:3000/
```

Expected: HTTP 200。応答しない場合は`cd app && npm run dev`で起動し、200になるまで待つ。

- [ ] **Step 2: in-app Browserで4幅を撮影する**

Use the same unauthenticated `/` state at each width:

- 390 × 844
- 768 × 1024
- 1024 × 844
- 1440 × 1024

Save the screenshots to the exact QA paths listed above. Before each capture, reload `/`, wait for all `main img` elements to report `complete && naturalWidth > 0`, and return scroll position to the top.

Expected: 4 screenshots exist, have the requested dimensions, and show no development overlay.

- [ ] **Step 3: 選択モックと実装を同一画像へ並べる**

Run:

```bash
ffmpeg -y \
  -i docs/design/lp-mobile-reference/concepts/layered-paper-waves-mobile-selected.png \
  -i docs/design/lp-mobile-reference/qa/implementation-paper-waves-390x844.png \
  -filter_complex "[0:v]scale=390:844[ref];[1:v]scale=390:844[impl];[ref][impl]hstack=inputs=2" \
  docs/design/lp-mobile-reference/qa/compare-paper-waves-mobile.png

ffmpeg -y \
  -i docs/design/lp-mobile-reference/concepts/layered-paper-waves-desktop-selected.png \
  -i docs/design/lp-mobile-reference/qa/implementation-paper-waves-1440x1024.png \
  -filter_complex "[0:v]scale=1440:1024[ref];[1:v]scale=1440:1024[impl];[ref][impl]hstack=inputs=2" \
  docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop.png
```

Expected: mobile comparison is 780 × 844、desktop comparison is 2880 × 1024。

- [ ] **Step 4: 比較画像を目視し、差分を修正する**

Open both comparison images with `view_image`. Judge the reference and implementation together, then inspect 768px and 1024px screenshots separately. Required pass criteria:

- スマホは上下方向の紙レイヤーがPhoto Orbitから次セクションへ流れる。
- PCは外周と下端へ横長の紙レイヤーが広がる。
- 中央のクリーム読み取り面が維持される。
- 見出し、本文、CTA、カード、FAQが紙境界へ重ならない。
- 4幅すべてで横あふれと背景の継ぎ目がない。
- 紙質感が写真より目立たない。
- 390pxでCTAがPhoto Orbitより前に残る。
- 1023px/1024pxのHeader切替に回帰がない。

If a criterion fails, fix only the responsible asset position, background-size, section transparency, or stage spacing. After each fix, rerun the Task 2 targeted UT and `guards.spec.ts`, recapture the affected width, and rebuild the corresponding comparison image.

- [ ] **Step 5: 操作と背景アセット配信を確認する**

In the in-app Browser:

1. 390pxでモバイルメニューを開き、`#faq`へ移動する。
2. FAQの2問目を開閉する。
3. 主要CTAの`href`が`/diagnosis/trial`、副CTAが`/opportunities`であることを確認する。
4. BrowserのCSS overridesは使わず、DevTools Networkでpaper-wavesの6URLが200を返すことを確認する。
5. Task 3の背景取得失敗E2EがGREENであり、クリーム背景上で見出し、CTA、4ステージ、横幅が成立した実行結果を確認する。

Expected: 5項目すべて成功する。

- [ ] **Step 6: QA結果を文書化する**

Create `docs/design/lp-mobile-reference/paper-waves-design-qa.md` with:

- selected mock paths
- implementation screenshot paths
- viewportごとの横あふれ、継ぎ目、文字重なり、画像クロップ結果
- メニュー、FAQ、CTA、アンカー結果
- background asset block時のフォールバック結果
- asset dimensions and byte sizes
- UT/E2E/lint/build command results
- `final result: passed` only after every criterion is actually green

未確認の項目や未実行の結果を成功扱いで記録しない。

- [ ] **Step 7: QA証跡をcommitする**

```bash
git add docs/design/lp-mobile-reference/paper-waves-design-qa.md \
  docs/design/lp-mobile-reference/qa/implementation-paper-waves-390x844.png \
  docs/design/lp-mobile-reference/qa/implementation-paper-waves-768x1024.png \
  docs/design/lp-mobile-reference/qa/implementation-paper-waves-1024x844.png \
  docs/design/lp-mobile-reference/qa/implementation-paper-waves-1440x1024.png \
  docs/design/lp-mobile-reference/qa/compare-paper-waves-mobile.png \
  docs/design/lp-mobile-reference/qa/compare-paper-waves-desktop.png
git commit -m "docs: Layered Paper WavesのDesign QAを記録"
```

---

### Task 5: Volunty完了ゲートを実行する

**Files:**
- Modify only when a verification failure requires it: Task 1–4 files。
- Final report: no new file required; summarize results in the task response。

**Interfaces:**
- Consumes: Tasks 1–4の実装とQA証跡。
- Produces: UT/E2E完了判定、lint/build結果、clean diff evidence。

- [ ] **Step 1: 変更分類を確定する**

Run:

```bash
git diff --name-only 96c5e7d..HEAD
```

Classify:

| 区分 | 判定 | 理由 |
| --- | --- | --- |
| UT | 必須 | 新しい`LPPaperStage`のvariant mappingと装飾DOMを追加したため |
| E2E | 必須 | 未ログインLPのDOM階層、レスポンシブ背景、主要フローに影響するため |

- [ ] **Step 2: 対象UTを再実行する**

Run:

```bash
cd app && npx vitest run \
  src/app/components/lp/LPPaperStage.test.tsx \
  src/app/components/lp/LPHeroSection.test.tsx \
  src/app/components/lp/DiagnosisTypesCarousel.test.tsx \
  src/app/components/lp/UsageSection.test.tsx \
  src/app/components/lp/BenefitsSection.test.tsx \
  src/app/components/lp/VoicesSection.test.tsx
```

Expected: all selected tests PASS.

- [ ] **Step 3: 全UT、lint、buildを実行する**

Run:

```bash
(cd app && npm test)
(cd app && npm run lint)
(cd app && npm run build)
```

Expected: all commands exit 0。Next.js buildの既知のdynamic server usage warningは、exit 0かつ今回差分に由来しない場合だけ記録して許容する。

- [ ] **Step 4: 全E2Eを実行する**

Run from repository root:

```bash
make e2e
```

Expected: all Playwright projects PASS。失敗した場合は原因を修正し、対象specでGREENを確認後に`make e2e`を最初から再実行する。

- [ ] **Step 5: アセットとdiffを最終確認する**

Run:

```bash
find app/public/images/lp/paper-waves -name '*.webp' -size +200k -print
git diff --check 96c5e7d..HEAD
git status --short
```

Expected:

- 200KB超のWebPがない。
- diff-check exit 0。
- `.codex/config.toml`と`.superpowers/`以外に未commitの実装差分がない。

- [ ] **Step 6: 完了報告用の結果表を埋める**

Final response must include actual values:

| 区分 | 判定 | 追加・更新したテスト | RED/GREEN | 最終結果 |
| --- | --- | --- | --- | --- |
| UT | 必須 | `LPPaperStage.test.tsx` + 既存LP回帰UT | module-not-found RED → 全対象GREEN | 実行数とPASS数 |
| E2E | 必須 | `guards.spec.ts` | stage count RED → GREEN | 全E2EのPASS数 |

Also report:

- 4 viewport Design QA result
- 6 asset byte sizes
- lint result
- build result
- remaining user-owned dirty paths

Do not claim completion until every required command and visual criterion is green.
