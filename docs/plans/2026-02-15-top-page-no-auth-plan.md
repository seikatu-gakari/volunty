# トップページ（認証なし）実装プラン

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Figmaデザイン通りの認証不要ランディングページを `/` ルートに実装する

**Architecture:** Server Componentとして `page.tsx` を1ファイルで実装。`layout.tsx` にNoto Sans JPフォントとメタデータを追加。`globals.css` にデザイントークンを定義。lucide-react でアイコン表示。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript 5 / Tailwind CSS 4 / lucide-react

**Design doc:** `docs/plans/2026-02-15-top-page-no-auth-design.md`

---

### Task 1: layout.tsx にNoto Sans JPフォントとメタデータを追加

**Files:**
- Modify: `app/src/app/layout.tsx`

**Step 1: layout.tsx を書き換え**

Noto Sans JP を `next/font/google` で読み込み、メタデータを日本語に、lang を "ja" に変更する。
既存の Geist フォントは削除する。

```tsx
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ボランティアマッチング | あなたにぴったりの活動を見つけよう",
  description:
    "簡単な診断を通じて、あなたの特性に最も適したボランティア活動をご提案します",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

**Step 2: ビルド確認**

Run: `cd app && npm run build`
Expected: ビルド成功

**Step 3: コミット**

```bash
git add app/src/app/layout.tsx
git commit -m "feat: layout.txsにNoto Sans JPフォントとメタデータを追加"
```

---

### Task 2: globals.css にデザイントークンを追加

**Files:**
- Modify: `app/src/app/globals.css`

**Step 1: globals.css を書き換え**

ダークモードを削除し、Voluntyのカラーパレットをカスタムプロパティとして定義する。

```css
@import "tailwindcss";

:root {
  --background: #ffeee2;
  --foreground: #6d2700;
  --primary: #fb5b01;
  --primary-dark: #c74700;
  --text-dark: #6d2700;
  --text-body: #8b4513;
  --card-border: rgba(203, 71, 0, 0.2);
  --header-border: rgba(203, 71, 0, 0.1);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-dark: var(--primary-dark);
  --color-text-dark: var(--text-dark);
  --color-text-body: var(--text-body);
  --color-card-border: var(--card-border);
  --color-header-border: var(--header-border);
  --font-sans: var(--font-noto-sans-jp);
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

**Step 2: ビルド確認**

Run: `cd app && npm run build`
Expected: ビルド成功

**Step 3: コミット**

```bash
git add app/src/app/globals.css
git commit -m "feat: globals.cssにVoluntyデザイントークンを追加"
```

---

### Task 3: page.tsx にトップページを実装

**Files:**
- Modify: `app/src/app/page.tsx`

**Step 1: page.tsx を書き換え**

Figmaデザインに忠実にランディングページを実装する。5セクション構成:
1. ヘッダー（ロゴ + ナビボタン）
2. ヒーロー（タイトル + CTA）
3. 特徴カード（3列）
4. 診断の種類（2列比較）
5. 利用の流れ（3ステップ）

```tsx
import Link from "next/link";
import {
  Heart,
  Sparkles,
  Zap,
  Brain,
  ArrowRight,
  Target,
  Users,
  LogIn,
  UserPlus,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-header-border bg-background/60 backdrop-blur-sm">
        <div className="mx-auto flex h-[77px] max-w-5xl items-center justify-between px-8 pt-4 pb-[1px]">
          <div className="flex items-center gap-2">
            <Heart className="size-8 text-primary" fill="#fb5b01" />
            <div className="flex flex-col">
              <span className="text-lg font-medium leading-7 text-text-dark">
                ボランティアマッチング
              </span>
              <span className="text-xs leading-4 text-text-body">
                あなたにぴったりの活動を見つけよう
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <LogIn className="size-4" />
              ログイン
            </Link>
            <Link
              href="/register"
              className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <UserPlus className="size-4" />
              新規登録
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="mx-auto max-w-3xl px-6 pt-6">
        {/* ヒーローセクション */}
        <section className="flex flex-col items-center gap-6 py-12">
          <div className="relative">
            <Heart
              className="size-20 text-primary"
              fill="#fb5b01"
              strokeWidth={0}
            />
            <Sparkles className="absolute -top-2 -right-1 size-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-4xl leading-[48px] text-text-dark md:text-5xl">
              あなたにぴったりの
              <br />
              <span className="text-primary">ボランティア活動</span>
              を見つけよう
            </h1>
          </div>
          <p className="max-w-xl text-center text-lg leading-7 text-text-body">
            簡単な診断を通じて、あなたの特性に最も適したボランティア活動をご提案します
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/diagnosis"
              className="flex h-11 items-center gap-2 rounded-lg border border-primary bg-background px-8 text-sm font-medium text-text-dark hover:bg-white"
            >
              <Zap className="size-5 text-primary" />
              10問 簡易診断
              <span className="text-xs opacity-75">約3分</span>
            </Link>
            <Link
              href="/diagnosis"
              className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Brain className="size-5" />
              96問 詳細診断
              <span className="text-xs opacity-75">約10分</span>
              <ArrowRight className="size-5" />
            </Link>
          </div>
          <p className="text-center text-sm text-text-body">
            まずは簡易診断でお試しいただき、より詳しく知りたい場合は詳細診断をお試しください
          </p>
        </section>

        {/* 特徴カード */}
        <section className="grid grid-cols-1 gap-6 py-12 md:grid-cols-3">
          {[
            {
              icon: <Target className="size-12 text-primary" />,
              title: "正確なマッチング",
              description:
                "10問の簡易診断や96問の詳細診断により、あなたの特性や志向を分析し、最適なボランティア活動をマッチングします",
            },
            {
              icon: <Users className="size-12 text-primary" />,
              title: "多様な活動",
              description:
                "教育支援、環境保護、災害支援、医療支援など、幅広いジャンルのボランティア活動から選択できます",
            },
            {
              icon: <Heart className="size-12 text-primary" />,
              title: "社会貢献",
              description:
                "あなたの特技や関心を活かして社会に貢献し、同じ志を持つ仲間と出会える機会を提供します",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-4 rounded-[10px] border border-card-border bg-white p-6 shadow-sm"
            >
              <div className="flex h-12 items-center justify-center">
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-text-dark">
                {feature.title}
              </h3>
              <p className="text-center text-sm leading-5 text-text-body">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        {/* 診断の種類 */}
        <section className="flex flex-col items-center gap-8 py-12">
          <h2 className="text-base text-text-dark">診断の種類</h2>
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
            {/* 簡易診断 */}
            <div className="rounded-[10px] border border-primary/30 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Zap className="size-8 text-primary" />
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-text-dark">
                    10問 簡易診断
                  </h3>
                  <p className="text-sm text-text-body">約3分で完了</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-2">
                {[
                  "サクッとボランティアタイプを診断",
                  "基本的な特性と傾向を分析",
                  "初めての方におすすめ",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-primary" />
                    <span className="text-sm text-text-dark">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* 詳細診断 */}
            <div className="rounded-[10px] border border-primary-dark/30 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Brain className="size-8 text-primary-dark" />
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-text-dark">
                    96問 詳細診断
                  </h3>
                  <p className="text-sm text-text-body">約10分で完了</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-2">
                {[
                  "より精密な性格分析",
                  "12の特性を多角的に分析",
                  "より適切なマッチングを実現",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-primary-dark" />
                    <span className="text-sm text-text-dark">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 利用の流れ */}
        <section className="flex flex-col items-center gap-8 py-12">
          <h2 className="text-base text-text-dark">利用の流れ</h2>
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: 1,
                color: "bg-primary",
                title: "ボランティア診断",
                description:
                  "10問または96問の質問に答えて、あなたのボランティアタイプを診断します",
              },
              {
                step: 2,
                color: "bg-primary-dark",
                title: "マッチング",
                description:
                  "診断結果に基づいて、あなたに最適なボランティア活動を提案します",
              },
              {
                step: 3,
                color: "bg-text-dark",
                title: "参加申し込み",
                description:
                  "気になる活動があれば、詳細を確認して参加申し込みができます",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div
                  className={`flex size-12 items-center justify-center rounded-full ${item.color} text-base font-medium text-white`}
                >
                  {item.step}
                </div>
                <h3 className="text-base text-text-dark">{item.title}</h3>
                <p className="text-sm leading-5 text-text-body">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
```

**Step 2: lint確認**

Run: `cd app && npm run lint`
Expected: エラーなし

**Step 3: ビルド確認**

Run: `cd app && npm run build`
Expected: ビルド成功

**Step 4: コミット**

```bash
git add app/src/app/page.tsx
git commit -m "feat: Figmaデザインに基づくトップページを実装"
```

---

### Task 4: 目視確認とスナップショットテスト

**Files:**
- なし（手動確認）

**Step 1: dev serverで目視確認**

Run: `cd app && npm run dev`

ブラウザで `http://localhost:3000` にアクセスし、以下を確認:
- ヘッダーにロゴ・ボタンが表示される
- ヒーローセクションにタイトル・CTAが表示される
- 特徴カード3枚が横並び（デスクトップ）
- 診断の種類カード2枚が横並び（デスクトップ）
- 利用の流れ3ステップが表示される
- モバイルサイズでレスポンシブ動作

**Step 2: Figmaスクリーンショットと見比べて差異を確認**

大きな差異があれば修正してコミット。
