# LP UI/UX改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LPのセクション構成の重複を解消し、温かみのあるビジュアルに洗練し、実態と乖離した文言と死んだフッターリンクを修正する。

**Architecture:** `app/src/app/components/lp/` 配下のLPコンポーネント群のみを変更する。重複していた「仕組み」「使い方」2セクションを新規 `UsageSection` に統合し、新規 `VoicesSection`(イメージ例明記の声カード)を追加。見出し装飾を共通コンポーネント `LPSectionHeading` に集約する。ロジック(Server Actions/DB/XState)への変更は一切ない。

**Tech Stack:** Next.js App Router (Server Components), Tailwind CSS v4 (`@theme inline` CSS変数), lucide-react, Vitest + Testing Library

**Spec:** [docs/superpowers/specs/2026-07-07-lp-ui-ux-improvement-design.md](../specs/2026-07-07-lp-ui-ux-improvement-design.md)

## Global Constraints

- UIテキスト・コードコメントは日本語で統一する。
- 「AI」「独自アルゴリズム」の語をLPの訴求文言に使わない(マッチングはルールベースのため)。
- ブランドカラー(`--primary: #fb5b01` 等)・`globals.css` の既存トークンは変更しない。新規CSSトークンも追加しない。
- 実データのない体験談・実績数値は必ず「イメージ例」であることを明記する。
- テストコマンドはすべて `app/` ディレクトリから実行する(例: `cd app && npx vitest run <path>`)。
- コミットメッセージ末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: LPSectionHeading 共通コンポーネント

各LPセクションで重複している見出しブロック(`✦ eyebrow ✦` + h2 + 説明文)を共通化し、「✦」をブランドのハートモチーフに置き換える。

**Files:**
- Create: `app/src/app/components/lp/LPSectionHeading.tsx`
- Test: `app/src/app/components/lp/LPSectionHeading.test.tsx`

**Interfaces:**
- Produces: `LPSectionHeading({ eyebrow: string; title: ReactNode; description?: ReactNode })` — 後続タスク(2, 3, 4, 6)がインポートして使う。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/app/components/lp/LPSectionHeading.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPSectionHeading } from "./LPSectionHeading";

describe("LPSectionHeading", () => {
  it("eyebrow・見出し・説明文を表示する", () => {
    render(
      <LPSectionHeading
        eyebrow="使い方"
        title="はじめるのは、かんたん3ステップ。"
        description="登録から参加まで、最短でその日のうちに。"
      />,
    );

    expect(screen.getByText("使い方")).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "はじめるのは、かんたん3ステップ。" }),
    ).toBeDefined();
    expect(
      screen.getByText("登録から参加まで、最短でその日のうちに。"),
    ).toBeDefined();
  });

  it("説明文を省略できる", () => {
    const { container } = render(
      <LPSectionHeading eyebrow="FAQ" title="よくある質問" />,
    );

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd app && npx vitest run src/app/components/lp/LPSectionHeading.test.tsx`
Expected: FAIL (`LPSectionHeading` が存在しない)

- [ ] **Step 3: 実装する**

`app/src/app/components/lp/LPSectionHeading.tsx`:

```tsx
import type { ReactNode } from "react";
import { Heart } from "lucide-react";

interface LPSectionHeadingProps {
  /** 見出し上の小ラベル */
  eyebrow: string;
  /** セクション見出し */
  title: ReactNode;
  /** 見出し下の補足説明（省略可） */
  description?: ReactNode;
}

/** LP各セクション共通の見出しブロック */
export function LPSectionHeading({ eyebrow, title, description }: LPSectionHeadingProps) {
  return (
    <div className="mb-12 text-center">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
        <Heart className="size-3.5 fill-primary/25" strokeWidth={1.5} aria-hidden />
        {eyebrow}
        <Heart className="size-3.5 fill-primary/25" strokeWidth={1.5} aria-hidden />
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-text-body">
          {description}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd app && npx vitest run src/app/components/lp/LPSectionHeading.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: コミット**

```bash
git add app/src/app/components/lp/LPSectionHeading.tsx app/src/app/components/lp/LPSectionHeading.test.tsx
git commit -m "feat: LP共通の見出しコンポーネントを追加

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: UsageSection(仕組み+使い方の統合)

`HowItWorksSection`(仕組み)と`HowToUseSection`(使い方)は同じ「診断→マッチング→参加」の3ステップを重複説明している。1つの `UsageSection` に統合し、旧2ファイルを削除。`page.tsx` とHeaderナビも追従する。

**Files:**
- Create: `app/src/app/components/lp/UsageSection.tsx`
- Test: `app/src/app/components/lp/UsageSection.test.tsx`
- Delete: `app/src/app/components/lp/HowItWorksSection.tsx`, `app/src/app/components/lp/HowToUseSection.tsx`
- Modify: `app/src/app/page.tsx`(インポートとセクション順), `app/src/app/components/Header.tsx:100-106`(ナビから `#shikumi` を削除)

**Interfaces:**
- Consumes: Task 1 の `LPSectionHeading`
- Produces: `UsageSection()`(引数なし、`id="usage"` のsection要素をレンダリング)

- [ ] **Step 1: 失敗するテストを書く**

`app/src/app/components/lp/UsageSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageSection } from "./UsageSection";

describe("UsageSection", () => {
  it("3ステップ（チェック・マッチング・参加）を表示する", () => {
    render(<UsageSection />);

    expect(screen.getByText("性格傾向チェック・登録")).toBeDefined();
    expect(screen.getByText("マッチング")).toBeDefined();
    expect(screen.getByText("参加・つながり")).toBeDefined();
  });

  it("ページ内リンク用の usage アンカーを持つ", () => {
    const { container } = render(<UsageSection />);

    expect(container.querySelector("section#usage")).not.toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd app && npx vitest run src/app/components/lp/UsageSection.test.tsx`
Expected: FAIL (`UsageSection` が存在しない)

- [ ] **Step 3: UsageSection を実装する**

`app/src/app/components/lp/UsageSection.tsx`:

```tsx
import { ClipboardList, Search, Handshake } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const STEPS = [
  {
    num: "1",
    label: "STEP 1",
    icon: ClipboardList,
    title: "性格傾向チェック・登録",
    desc: "世界中で使われている性格研究をもとに、5つの性格特性の傾向を確認。簡易15問（約2分）と全50問（約5〜8分）から選べて、登録は無料です。",
    color: "bg-linear-to-br from-orange-50 to-amber-100 text-primary",
  },
  {
    num: "2",
    label: "STEP 2",
    icon: Search,
    title: "マッチング",
    desc: "興味分野・地域・日程を主に、性格の傾向も一部参考にして、あなたに合う順に活動を表示。団体からアプローチが届くことも。",
    color: "bg-linear-to-br from-purple-50 to-violet-100 text-purple-600",
  },
  {
    num: "3",
    label: "STEP 3",
    icon: Handshake,
    title: "参加・つながり",
    desc: "「なぜおすすめなのか」の理由を確認して、納得してから応募。参加の先に、新しい仲間や小さな承認体験が待っています。",
    color: "bg-linear-to-br from-green-50 to-emerald-100 text-green-600",
  },
];

export function UsageSection() {
  return (
    <section
      id="usage"
      className="glass-card relative z-10 mt-20 overflow-hidden rounded-3xl p-8 ring-1 ring-white/60 sm:mt-28 sm:p-12"
    >
      <div className="lp-blob -top-12 -right-12 size-72 bg-primary/20" aria-hidden />
      <div className="lp-blob -bottom-16 -left-16 size-72 bg-primary-light/30" aria-hidden />

      <LPSectionHeading
        eyebrow="使い方"
        title="はじめるのは、かんたん3ステップ。"
        description="自分の傾向を知ることが、合う活動への近道。登録から参加まで、最短でその日のうちに。"
      />

      <div className="grid gap-8 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={i} className="relative flex flex-col items-center text-center">
            <div className="mb-2 text-xs font-bold text-primary">{step.label}</div>
            <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-dark text-xl font-extrabold text-white shadow-md">
              {step.num}
            </div>
            {i < 2 && (
              <div className="absolute top-9 left-[calc(50%+28px)] hidden h-0.5 w-[calc(100%-56px)] bg-primary/20 md:block" />
            )}
            <span
              className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${step.color}`}
            >
              <step.icon className="size-7" />
            </span>
            <h3 className="text-lg font-bold text-text-dark">{step.title}</h3>
            <p className="mt-3 max-w-[280px] text-sm leading-6 text-text-body">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd app && npx vitest run src/app/components/lp/UsageSection.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: page.tsx を新構成に更新し、旧2ファイルを削除する**

`app/src/app/page.tsx` のインポートを変更（`HowItWorksSection`・`HowToUseSection` を削除し `UsageSection` を追加）:

```tsx
import { Header } from "./components/Header";
import { AuthenticatedHome } from "./components/AuthenticatedHome";
import { Reveal } from "./components/lp/Reveal";
import { LPHeroSection } from "./components/lp/LPHeroSection";
import { DiagnosisTypesCarousel } from "./components/lp/DiagnosisTypesCarousel";
import { DiagnosisTypesGrid } from "./components/lp/DiagnosisTypesGrid";
import { PainPointsSection } from "./components/lp/PainPointsSection";
import { UsageSection } from "./components/lp/UsageSection";
import { BenefitsSection } from "./components/lp/BenefitsSection";
import { FeaturesSection } from "./components/lp/FeaturesSection";
import { FAQSection } from "./components/lp/FAQSection";
import { LPBottomCTA } from "./components/lp/LPBottomCTA";
import { LPFooter } from "./components/lp/LPFooter";
import { createClient } from "@/lib/supabase/server";
```

未ログイン時のmain内セクション順を以下に変更（ヒーロー・blob装飾・カルーセルは現状のまま）:

```tsx
          {/* ヒーロー */}
          <LPHeroSection />

          {/* 診断タイプカルーセル */}
          <Reveal>
            <div className="relative z-10 mt-20 sm:mt-28">
              <DiagnosisTypesCarousel />
            </div>
          </Reveal>

          {/* 課題セクション */}
          <Reveal>
            <PainPointsSection />
          </Reveal>

          {/* 使い方（仕組みと統合） */}
          <Reveal>
            <UsageSection />
          </Reveal>

          {/* 10タイプグリッド */}
          <Reveal>
            <DiagnosisTypesGrid />
          </Reveal>

          {/* 参加メリット */}
          <Reveal>
            <BenefitsSection />
          </Reveal>

          {/* 主な機能 */}
          <Reveal>
            <FeaturesSection />
          </Reveal>

          {/* FAQ */}
          <Reveal>
            <FAQSection />
          </Reveal>

          {/* ボトム CTA */}
          <Reveal>
            <LPBottomCTA />
          </Reveal>

          {/* フッター */}
          <LPFooter />
```

※ `VoicesSection` はTask 3で `BenefitsSection` の直後に挿入する。

旧ファイルを削除:

```bash
rm app/src/app/components/lp/HowItWorksSection.tsx app/src/app/components/lp/HowToUseSection.tsx
```

- [ ] **Step 6: Header のナビから「仕組み」を削除する**

`app/src/app/components/Header.tsx` の未ログイン時ナビ(100〜106行目付近)を変更:

```tsx
            {[
              { href: "#kadai", label: "課題" },
              { href: "#usage", label: "使い方" },
              { href: "#types", label: "診断タイプ" },
              { href: "#faq", label: "FAQ" },
            ].map((item) => (
```

（`#shikumi` を削除。新構成の出現順 = 課題 → 使い方 → 診断タイプ → FAQ に合わせて並び替え）

- [ ] **Step 7: 全体テスト・lintで回帰がないことを確認する**

Run: `cd app && npx vitest run && npm run lint`
Expected: 全テストPASS、lintエラーなし（削除したコンポーネントへの参照が残っていればここで検出される）

- [ ] **Step 8: コミット**

```bash
git add -A app/src/app/components/lp/ app/src/app/page.tsx app/src/app/components/Header.tsx
git commit -m "feat: LPの仕組み・使い方セクションを統合して重複を解消

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: VoicesSection(声セクション・新規)

参加者・団体の「こんな声」を伝えるカードセクションを新規追加する。実データがないため「イメージ例」であることを明記する。

**Files:**
- Create: `app/src/app/components/lp/VoicesSection.tsx`
- Test: `app/src/app/components/lp/VoicesSection.test.tsx`
- Modify: `app/src/app/page.tsx`(`BenefitsSection` の直後に挿入)

**Interfaces:**
- Consumes: Task 1 の `LPSectionHeading`
- Produces: `VoicesSection()`(引数なし)

- [ ] **Step 1: 失敗するテストを書く**

`app/src/app/components/lp/VoicesSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VoicesSection } from "./VoicesSection";

describe("VoicesSection", () => {
  it("参加者と団体の声カードを表示する", () => {
    render(<VoicesSection />);

    expect(screen.getByText(/はじめての参加/)).toBeDefined();
    expect(screen.getByText(/NPO法人/)).toBeDefined();
  });

  it("実際の声ではなくイメージ例であることを明記する", () => {
    render(<VoicesSection />);

    // 見出し下の説明と末尾の注記の両方でイメージ例であることを示す
    expect(screen.getAllByText(/イメージ例/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/実際のご利用者の声ではありません/),
    ).toBeDefined();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd app && npx vitest run src/app/components/lp/VoicesSection.test.tsx`
Expected: FAIL (`VoicesSection` が存在しない)

- [ ] **Step 3: 実装する**

`app/src/app/components/lp/VoicesSection.tsx`:

```tsx
import { Quote } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

/** 利用イメージを伝えるための例示（実際のユーザーの声ではない） */
const VOICES = [
  {
    role: "20代・はじめての参加",
    tag: "サポータータイプ",
    text: "「自分に向いてる活動」から探せたので、初参加でも不安が少なかったです。受付サポートから始めました。",
    gradient: "from-blue-50 to-sky-50",
    accent: "text-blue-600 bg-blue-100",
  },
  {
    role: "30代・月1ペースで活動",
    tag: "アイデアマンタイプ",
    text: "おすすめ理由が書いてあるから、納得して選べる。子ども向けワークショップの手伝いが楽しくて続いています。",
    gradient: "from-purple-50 to-violet-50",
    accent: "text-purple-600 bg-purple-100",
  },
  {
    role: "NPO法人・イベント運営",
    tag: "団体",
    text: "活動の雰囲気に合いそうな方へ、こちらからアプローチできるのが助かります。当日のミスマッチが減りました。",
    gradient: "from-orange-50 to-amber-50",
    accent: "text-primary bg-primary/10",
  },
];

export function VoicesSection() {
  return (
    <section className="relative z-10 mt-20 sm:mt-28">
      <LPSectionHeading
        eyebrow="こんな使われ方"
        title="ひとりひとりの「ちょうどいい」参加へ。"
        description="Voluntyが目指す利用シーンのイメージ例です。"
      />

      <div className="grid gap-6 sm:grid-cols-3">
        {VOICES.map((voice) => (
          <div
            key={voice.role}
            className={`flex flex-col rounded-3xl bg-linear-to-br ${voice.gradient} p-6 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10`}
          >
            <Quote className="mb-4 size-6 text-primary/40" aria-hidden />
            <p className="flex-1 text-sm leading-7 text-text-dark">{voice.text}</p>
            <div className="mt-5 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-text-body">{voice.role}</p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${voice.accent}`}
              >
                {voice.tag}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-text-body opacity-70">
        ＊ 上記は利用シーンのイメージ例であり、実際のご利用者の声ではありません。
      </p>
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd app && npx vitest run src/app/components/lp/VoicesSection.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: page.tsx に組み込む**

`app/src/app/page.tsx` にインポートを追加:

```tsx
import { VoicesSection } from "./components/lp/VoicesSection";
```

`BenefitsSection` の直後・`FeaturesSection` の直前に挿入:

```tsx
          {/* 参加メリット */}
          <Reveal>
            <BenefitsSection />
          </Reveal>

          {/* 利用イメージ（声） */}
          <Reveal>
            <VoicesSection />
          </Reveal>

          {/* 主な機能 */}
          <Reveal>
            <FeaturesSection />
          </Reveal>
```

- [ ] **Step 6: コミット**

```bash
git add app/src/app/components/lp/VoicesSection.tsx app/src/app/components/lp/VoicesSection.test.tsx app/src/app/page.tsx
git commit -m "feat: LPに利用イメージの声セクションを追加

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: FeaturesSection のコピー修正

「性格診断・AI分析」「独自アルゴリズム」はルールベースのマッチング実態と乖離しているため是正する。あわせて `LPSectionHeading` を適用し、アイコンチップをグラデーション化する。

**Files:**
- Modify: `app/src/app/components/lp/FeaturesSection.tsx`
- Test: `app/src/app/components/lp/FeaturesSection.test.tsx`(新規)

**Interfaces:**
- Consumes: Task 1 の `LPSectionHeading`

- [ ] **Step 1: 失敗するテストを書く**

`app/src/app/components/lp/FeaturesSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeaturesSection } from "./FeaturesSection";

describe("FeaturesSection", () => {
  it("実態と乖離するAI・独自アルゴリズム表現を含まない", () => {
    render(<FeaturesSection />);

    expect(screen.queryByText(/AI/)).toBeNull();
    expect(screen.queryByText(/独自アルゴリズム/)).toBeNull();
  });

  it("性格傾向マッチングの機能を表示する", () => {
    render(<FeaturesSection />);

    expect(screen.getByText("性格傾向マッチング")).toBeDefined();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd app && npx vitest run src/app/components/lp/FeaturesSection.test.tsx`
Expected: FAIL（「性格診断・AI分析」が存在するため1つ目が失敗、「性格傾向マッチング」が無いため2つ目も失敗）

- [ ] **Step 3: FeaturesSection を書き換える**

`app/src/app/components/lp/FeaturesSection.tsx` の全体を以下に置き換え:

```tsx
import { Brain, Search, MessageCircle, Calendar } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const FEATURES = [
  {
    icon: Brain,
    title: "性格傾向マッチング",
    desc: "興味分野・地域・日程に性格の傾向も組み合わせて、あなたに合う順に活動を提案します。",
  },
  {
    icon: Search,
    title: "双方向アプローチ",
    desc: "あなたに興味を持った団体からアプローチが届く、双方向のマッチング。",
  },
  {
    icon: MessageCircle,
    title: "メッセージ機能",
    desc: "気になる団体と直接やり取り。不安をなくしてから参加できます。",
  },
  {
    icon: Calendar,
    title: "活動管理・記録",
    desc: "参加した活動を記録・管理。小さな実績がきちんと積み上がります。",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 mt-20 sm:mt-28">
      <LPSectionHeading
        eyebrow="主な機能"
        title="続けやすさまで、まるごと設計。"
        description="出会うだけで終わらない。安心して参加し、実績を積み上げられる機能がそろっています。"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-3xl border border-card-border bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
          >
            <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-linear-to-br from-orange-50 to-amber-100 text-primary">
              <item.icon className="size-8" />
            </span>
            <h3 className="text-lg font-bold text-text-dark">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-text-body">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd app && npx vitest run src/app/components/lp/FeaturesSection.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: コミット**

```bash
git add app/src/app/components/lp/FeaturesSection.tsx app/src/app/components/lp/FeaturesSection.test.tsx
git commit -m "fix: LP機能セクションのAI表現を実態に合わせて修正

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: LPFooter のリンク修正

プレースホルダー`#`リンクを実在する遷移先に接続し、実ページのない項目(お問い合わせ・運営会社・プライバシーポリシー・利用規約)を削除する。「AIが見つける」の文言も是正する。

**Files:**
- Modify: `app/src/app/components/lp/LPFooter.tsx`
- Test: `app/src/app/components/lp/LPFooter.test.tsx`(新規)

- [ ] **Step 1: 失敗するテストを書く**

`app/src/app/components/lp/LPFooter.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LPFooter } from "./LPFooter";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("LPFooter", () => {
  it("実在する遷移先にリンクする", () => {
    render(<LPFooter />);

    expect(
      screen.getByRole("link", { name: "性格傾向チェック" }).getAttribute("href"),
    ).toBe("/diagnosis");
    expect(
      screen.getByRole("link", { name: "活動を探す" }).getAttribute("href"),
    ).toBe("/opportunities");
    expect(
      screen.getByRole("link", { name: "団体の方へ" }).getAttribute("href"),
    ).toBe("/signup");
    expect(
      screen.getByRole("link", { name: "使い方ガイド" }).getAttribute("href"),
    ).toBe("#usage");
    expect(
      screen.getByRole("link", { name: "よくある質問" }).getAttribute("href"),
    ).toBe("#faq");
  });

  it("プレースホルダーリンクと未実装ページへのリンクを含まない", () => {
    render(<LPFooter />);

    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link.getAttribute("href")).not.toBe("#");
    }
    expect(screen.queryByText("運営会社")).toBeNull();
    expect(screen.queryByText("プライバシーポリシー")).toBeNull();
    expect(screen.queryByText("利用規約")).toBeNull();
    expect(screen.queryByText("お問い合わせ")).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd app && npx vitest run src/app/components/lp/LPFooter.test.tsx`
Expected: FAIL（現状は全リンクが `#`）

- [ ] **Step 3: LPFooter を書き換える**

`app/src/app/components/lp/LPFooter.tsx` の全体を以下に置き換え:

```tsx
import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";

const LINK_GROUPS = [
  {
    heading: "サービス",
    links: [
      { label: "性格傾向チェック", href: "/diagnosis" },
      { label: "活動を探す", href: "/opportunities" },
      { label: "団体の方へ", href: "/signup" },
    ],
  },
  {
    heading: "サポート",
    links: [
      { label: "使い方ガイド", href: "#usage" },
      { label: "よくある質問", href: "#faq" },
    ],
  },
];

export function LPFooter() {
  return (
    <footer className="relative z-10 mt-20 border-t border-card-border pb-10 pt-12">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Link href="/" className="mb-4 flex items-center gap-2">
            <div className="relative">
              <Heart className="size-7 text-primary" fill="#fb5b01" strokeWidth={0} />
              <Sparkles className="absolute -top-1 -right-1 size-3 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-text-dark">Volunty</span>
              <span className="text-xs text-text-body">ボランティー</span>
            </div>
          </Link>
          <p className="text-xs leading-6 text-text-body">
            つながる、みつかる、変わっていく。<br />
            あなたにぴったりのボランティアが見つかる。
          </p>
        </div>

        {LINK_GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="mb-3 text-sm font-bold text-text-dark">{group.heading}</p>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-xs text-text-body transition-colors hover:text-text-dark"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-card-border pt-6 sm:flex-row">
        <p className="text-xs text-text-body">© 2025 Volunty. All rights reserved.</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd app && npx vitest run src/app/components/lp/LPFooter.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: コミット**

```bash
git add app/src/app/components/lp/LPFooter.tsx app/src/app/components/lp/LPFooter.test.tsx
git commit -m "fix: LPフッターの死んだリンクを実在ページに接続

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 残りセクションのビジュアル洗練

PainPoints・Benefits・DiagnosisTypesGrid・FAQ の各セクションに `LPSectionHeading` を適用し、アイコンチップのグラデーション化・角丸拡大・影の色味調整を行う。`page.tsx` のblob装飾を大きく・淡くする。文言・構造は変えないため既存テストへの影響はない（見出し構造は h2 のまま）。

**Files:**
- Modify: `app/src/app/components/lp/PainPointsSection.tsx`
- Modify: `app/src/app/components/lp/BenefitsSection.tsx`
- Modify: `app/src/app/components/lp/DiagnosisTypesGrid.tsx`
- Modify: `app/src/app/components/lp/FAQSection.tsx`
- Modify: `app/src/app/page.tsx`(blob装飾)

**Interfaces:**
- Consumes: Task 1 の `LPSectionHeading`

- [ ] **Step 1: PainPointsSection の見出しと角丸を更新する**

`app/src/app/components/lp/PainPointsSection.tsx`:

インポートに追加:

```tsx
import { LPSectionHeading } from "./LPSectionHeading";
```

見出しブロック（`<div className="mb-12 text-center">`〜`</div>`）を置き換え:

```tsx
      <LPSectionHeading
        eyebrow="なぜ、はじめられない？"
        title="「やってみたい」のに、一歩を踏み出せない。"
        description="ボランティアに関心はあっても、参加に至らない人は多数。その「つまずき」を、Voluntyはひとつずつ解消します。"
      />
```

カードの角丸を拡大（`rounded-2xl` → `rounded-3xl`）:

```tsx
            className="flex flex-col items-stretch gap-3 rounded-3xl border border-card-border bg-white p-5 shadow-sm sm:flex-row sm:items-center"
```

- [ ] **Step 2: BenefitsSection の見出し・チップ・影を更新する**

`app/src/app/components/lp/BenefitsSection.tsx`:

インポートに追加:

```tsx
import { LPSectionHeading } from "./LPSectionHeading";
```

`BENEFITS` の `color` をグラデーションに変更:

```tsx
const BENEFITS = [
  {
    icon: Users,
    title: "気楽な雰囲気で交流",
    desc: "普段接点のない人と、自然に会話できる場。肩ひじ張らずに。",
    color: "bg-linear-to-br from-blue-50 to-sky-100 text-blue-600",
  },
  {
    icon: Star,
    title: "小さな承認体験",
    desc: "「ありがとう」と言われる瞬間。目に見える手ごたえがある。",
    color: "bg-linear-to-br from-amber-50 to-yellow-100 text-amber-600",
  },
  {
    icon: TrendingUp,
    title: "目に見える成果",
    desc: "自己成長やつながりが、記録として少しずつ積み上がる。",
    color: "bg-linear-to-br from-green-50 to-emerald-100 text-green-600",
  },
];
```

見出しブロックを置き換え:

```tsx
      <LPSectionHeading
        eyebrow="参加して、変わっていく"
        title="義務じゃない。楽しいから続く。"
        description="交流、小さな承認、目に見える成果。Voluntyのボランティアは、自分のための時間にもなります。"
      />
```

カードの角丸・影を変更:

```tsx
            className="flex flex-col items-center rounded-3xl border border-card-border bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
```

- [ ] **Step 3: DiagnosisTypesGrid の見出し・チップ・影を更新する**

`app/src/app/components/lp/DiagnosisTypesGrid.tsx`:

インポートに追加:

```tsx
import { LPSectionHeading } from "./LPSectionHeading";
```

`TYPE_DISPLAY` の `color` をグラデーションに変更:

```tsx
const TYPE_DISPLAY: Record<string, { icon: typeof Users; color: string }> = {
  "innovator-leader": { icon: Star, color: "bg-linear-to-br from-red-50 to-orange-100 text-red-600" },
  "supporter-care": { icon: Heart, color: "bg-linear-to-br from-pink-50 to-rose-100 text-pink-600" },
  "creative-solo": { icon: Lightbulb, color: "bg-linear-to-br from-purple-50 to-violet-100 text-purple-600" },
  "perfectionist-analyst": { icon: BarChart2, color: "bg-linear-to-br from-indigo-50 to-blue-100 text-indigo-600" },
  "charisma-entertainer": { icon: MessageCircle, color: "bg-linear-to-br from-yellow-50 to-amber-100 text-yellow-600" },
  "strategist-planner": { icon: Zap, color: "bg-linear-to-br from-green-50 to-emerald-100 text-green-600" },
  "harmony-mediator": { icon: Handshake, color: "bg-linear-to-br from-blue-50 to-sky-100 text-blue-600" },
  "adventure-explorer": { icon: Compass, color: "bg-linear-to-br from-orange-50 to-amber-100 text-primary" },
  "conservative-guardian": { icon: Shield, color: "bg-linear-to-br from-teal-50 to-cyan-100 text-teal-600" },
  "sensitive-artist": { icon: Users, color: "bg-linear-to-br from-rose-50 to-pink-100 text-rose-600" },
};
```

フォールバック（`display` の `??` 右辺）も合わせて変更:

```tsx
          const display = TYPE_DISPLAY[type.id] ?? {
            icon: Users,
            color: "bg-linear-to-br from-orange-50 to-amber-100 text-primary",
          };
```

見出しブロックを置き換え:

```tsx
      <LPSectionHeading
        eyebrow="10の活動スタイル（参考タイプ）"
        title="あなたは、どのスタイルに近い？"
        description={
          <>
            性格傾向チェックの結果を、活動スタイルの参考タイプとして分かりやすく表示します。
            タイプは理解を助けるための参考情報で、どの活動にも応募できます。
          </>
        }
      />
```

カードの影を変更:

```tsx
              className="flex flex-col rounded-2xl border border-card-border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
```

（5列グリッドの小カードのため角丸は `rounded-2xl` のまま維持する）

- [ ] **Step 4: FAQSection の見出しを更新する**

`app/src/app/components/lp/FAQSection.tsx`:

インポートに追加:

```tsx
import { LPSectionHeading } from "./LPSectionHeading";
```

見出しブロックを置き換え:

```tsx
      <LPSectionHeading
        eyebrow="よくある質問"
        title="はじめる前の、ちいさな不安に。"
      />
```

- [ ] **Step 5: page.tsx のblobを大きく・淡くする**

`app/src/app/page.tsx` のblob装飾4つを置き換え:

```tsx
          {/* 背景 blob 装飾 */}
          <div className="lp-blob top-[120px] -left-32 size-[480px] bg-primary/20" aria-hidden />
          <div className="lp-blob top-[640px] -right-32 size-[560px] bg-primary-light/30" aria-hidden />
          <div className="lp-blob top-[1400px] left-1/3 size-[520px] bg-secondary/10" aria-hidden />
          <div className="lp-blob top-[2200px] -left-24 size-[560px] bg-primary/10" aria-hidden />
```

- [ ] **Step 6: 全体テスト・lintで回帰がないことを確認する**

Run: `cd app && npx vitest run && npm run lint`
Expected: 全テストPASS、lintエラーなし

- [ ] **Step 7: コミット**

```bash
git add app/src/app/components/lp/ app/src/app/page.tsx
git commit -m "feat: LP各セクションのビジュアルを温かみのあるトーンに統一

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 最終検証

**Files:** 変更なし（検証のみ）

- [ ] **Step 1: 全ユニットテストを実行する**

Run: `cd app && npx vitest run`
Expected: 全テストPASS

- [ ] **Step 2: lint・型チェック・ビルドを実行する**

Run: `cd app && npm run lint && npx tsc --noEmit && npm run build`
Expected: エラーなし、ビルド成功

- [ ] **Step 3: ブラウザでLPを確認する**

dev サーバーを起動し（`.claude/launch.json` の `volunty-dev`）、以下を確認:

1. 未ログインのトップページで新セクション順（Hero → カルーセル → 課題 → 使い方 → 10タイプ → メリット → 声 → 機能 → FAQ → CTA → フッター）で表示される
2. ヘッダーナビの「使い方」「FAQ」等のアンカーが正しくスクロールする（`#shikumi` リンクが存在しない）
3. フッターの各リンクが正しい遷移先を指す
4. 声セクションに「イメージ例」の注記が表示される
5. モバイル幅(375px)でレイアウト崩れがない

- [ ] **Step 4: volunty-test-completion-gate skill でテスト完了判定を行う**

E2E（`app/e2e/`）にLP関連のテストがあれば影響を確認し、必要なら追従修正する。

- [ ] **Step 5: 実装完了の報告**

変更点・確認結果・残タスク（プライバシーポリシー等の法務ページ作成、ログイン後画面のUI改善は別タスク）をまとめて報告する。
