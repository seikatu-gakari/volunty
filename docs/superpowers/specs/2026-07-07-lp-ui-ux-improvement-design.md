# LP(トップページ) UI/UX改善 設計書

- 作成日: 2026-07-07
- 対象: `app/src/app/page.tsx` および `app/src/app/components/lp/` 配下の全コンポーネント
- 背景: 直近のコミット(d3f4fb6)でデザインシステムを白背景ベースに刷新済み。今回はその上で
  LP構成の重複解消と、温かみ・親しみやすさ重視の視覚的な洗練を行う。

## 目的

- LP構成(セクション順・重複)を整理し、離脱を招く冗長な説明を減らす。
- 視覚トーンを「白背景+オレンジ暖色系+丸みのあるblob装飾」を維持したまま、より温かみ・親しみやすさのある印象に近づける。
- 実態と乖離した訴求文言(AI分析・独自アルゴリズム表現)を是正する。
- フッターの死んだリンク(プレースホルダー`#`)を解消する。

## スコープ外(明示)

- ログイン後のダッシュボード/マイページ/診断フロー画面/管理画面のUI改善(別タスク)
- プライバシーポリシー・利用規約・運営会社ページ・お問い合わせページの新規作成
- ブランドカラー(オレンジ基調 `--primary` 等)自体の変更
- マッチングエンジン(`app/src/lib/recommendations/engine.ts`)のロジック変更

## 1. セクション構成の再編成

### 現状(10ブロック、`app/src/app/page.tsx`)

Hero → 診断タイプカルーセル → 10タイプグリッド → 課題(PainPoints) → 仕組み(HowItWorks)
→ 参加メリット(Benefits) → 使い方(HowToUse) → 主な機能(Features) → FAQ → ボトムCTA → フッター

`HowItWorksSection`(仕組み)と`HowToUseSection`(使い方)はいずれも
「診断 → マッチング → 参加」の3ステップを説明しており内容が重複している。

### 変更後

1. Header
2. Hero (現状維持、文言は軽微な調整のみ)
3. 診断タイプカルーセル(`DiagnosisTypesCarousel`、現状維持)
4. 課題セクション「なぜ、はじめられない？」(`PainPointsSection`、現状維持)
5. **使い方セクション(統合)** — `HowItWorksSection` と `HowToUseSection` を1コンポーネントに統合。
   3ステップ(診断・登録 → マッチング → 参加・つながり)とし、「おすすめ理由の見える化」を
   ステップ2の補足コピーに内包する。アンカーIDは `usage` を採用(`shikumi` は廃止)。
6. 10タイプグリッド(`DiagnosisTypesGrid`、現状維持)
7. 参加メリット(`BenefitsSection`、現状維持)
8. **声セクション(新規)** — `VoicesSection` を新規作成。参加者・団体からの声を
   3〜4件のカード形式で表示。実データが存在しないため、診断カルーセルと同様に
   「※イメージ例」であることを見出し直下に明記する。
9. 主な機能(`FeaturesSection`、コピー修正 — 詳細は2章)
10. FAQ(`FAQSection`、現状維持)
11. ボトムCTA(`LPBottomCTA`、現状維持)
12. フッター(`LPFooter`、リンク修正 — 詳細は3章)

`HowItWorksSection.tsx` と `HowToUseSection.tsx` は統合後に削除し、新規
`UsageSection.tsx` に置き換える。`page.tsx` のインポート・JSXも追従して修正する。

## 2. ビジュアルの洗練(温かみ・親しみやすさ)

現状はlucide-reactアイコン+単色パステル背景チップが中心。以下の方向で調整する。

- アイコンチップ: 単色ベタ塗り(例: `bg-blue-100 text-blue-600`)から、
  `DiagnosisTypesCarousel` で既に使われている淡いグラデーション表現
  (`bg-linear-to-br from-*-50 to-*-50`)に寄せた柔らかい配色に統一する。
- 角丸: カードの角丸を `rounded-2xl` 主体から一部 `rounded-3xl` に拡大し、
  セクション間の余白も詰まって見える箇所を広げる。
- 見出し装飾: 各セクション見出し上の「✦」記号を、ブランドロゴ(`Heart`アイコン)の
  世界観に合わせた柔らかいアクセント(小さいハートモチーフや波線)に置き換える。
- 影: カードhover時の影(`hover:shadow-lg`)をニュートラルグレーから
  オレンジ系の柔らかい影(`shadow-primary/10` 相当)に調整し、硬さを軽減する。
- Hero画像まわりのblob装飾(`lp-blob`)をやや大きく・淡くし、ふんわりした印象を強調する。

いずれも既存の `globals.css` の `@theme inline` 変数・`.lp-blob` 等の
ユーティリティクラスを流用し、新しいトークンは追加しない。

## 3. コピー・リンクの修正

### FeaturesSection

- 現状: 「性格診断・AI分析」「独自アルゴリズムで特性や強みを可視化」
- 修正後: マッチングがルールベース(興味分野・地域・日程・参加形態・性格傾向を
  組み合わせた評価)である実態に即した表現に変更する。「AI」「独自アルゴリズム」の語は使わない。

### LPFooter

| 現状のリンク | 変更後 |
|---|---|
| 性格診断について | `/diagnosis` |
| 活動を探す | `/opportunities` |
| 団体の方へ | `/signup` |
| 使い方ガイド | `#usage`(統合後の使い方セクション) |
| よくある質問 | `#faq` |
| お問い合わせ | 削除(実ページなし) |
| 運営会社 | 削除(実ページなし) |
| プライバシーポリシー | 削除(実ページなし) |
| 利用規約 | 削除(実ページなし) |

「サポート」「運営」の列見出しごと項目が空になる場合は、列自体を削除し
グリッド列数(`lg:grid-cols-4` → `lg:grid-cols-3`)を調整する。

## 4. 影響範囲・テスト

- 変更対象は `app/src/app/page.tsx` と `app/src/app/components/lp/` 配下のみ。
  Server Actions・DB・XState等のロジックへの影響はない。
- 既存の `DiagnosisTypesCarousel.test.tsx`・`LPHeroSection.test.tsx` は
  文言・構造変更があれば追従して更新する。
- 新規 `UsageSection.tsx`・`VoicesSection.tsx` にはユニットテスト(レンダリング確認)を追加する。
- `HowItWorksSection.tsx`・`HowToUseSection.tsx` に対応するテストがあれば削除・統合する。
- 実装完了前に `volunty-test-completion-gate` skill でUT/E2E追加要否を判定する。
- ブラウザでのLP表示確認(デスクトップ・モバイル幅)を実施し、レイアウト崩れがないことを確認する。
