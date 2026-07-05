---
name: volunty-architecture-design
description: 'Use when: Volunty のアーキテクチャ、Server Components 方針、XState 診断フロー、BIG5 スコア計算、デザインカラーを確認する必要がある。'
argument-hint: '例: 診断フローを変更 / Server Component方針を確認 / デザイン色を確認'
---

# アーキテクチャ・設計

## 原則

- Server Components をデフォルトにする。
- ドメインロジックは `app/src/lib/` に集約する。
- 複数ステップのフロー管理には XState を使う。
- TypeScript strict mode を前提に型安全に実装する。

## 診断フロー (XState)

```text
idle → answering → checkProgress → completed
  │        ↑│
RESTORE    └┘（次の質問へ / BACK で戻る）
```

- `DiagnosisWizard` が `useMachine` を使い、中断・再開（localStorage + RESTORE）と回答時間計測を担う。
- 採点は Server Action 側で純粋関数（`app/src/lib/diagnosis-scale/scoring.ts`）により実行する。

## 診断採点（IPIP-BFM-50 日本語版・全50問）

- 質問・採点キー・出典・版は `app/src/lib/diagnosis-scale/scale.ts` が単一の情報源（public domain の IPIP 項目）。
- 逆転項目（-keyed）は `6 - 回答値` で処理する。
- raw score = ドメイン内10項目の合計（10〜50 の整数）。表示用は `(raw - 10) / 40 * 100`（小数1桁）。
  これは回答の換算値であり、母集団内の位置（percentile）ではない。
- 尺度・採点・標準化・参考タイプ・品質ルールの各バージョンを診断結果に保存する。
- 10 の参考タイプは補助情報（`style-types.ts`）。閾値の「完全一致」判定は廃止済み。

## マッチング（ルールベース）

- `app/src/lib/recommendations/engine.ts` がハード条件（終了・定員・年齢）とランキングを分離して評価する。
- ランキング: 興味分野 0.35 / 地域 0.15 / 日程 0.15 / 参加形態 0.10 / 性格適合 0.15（加点のみ）/ 新着 0.10。欠損は重みを再正規化。
- 推薦の生成・表示は `t_recommendation_log` に記録する。診断とマッチングは独立に評価する。

## デザインカラー

`@theme inline` で Tailwind クラス化されている CSS 変数を使う。

```css
--background: #ffeee2;
--primary: #fb5b01;
--primary-dark: #c74700;
--text-dark: #6d2700;
--text-body: #8b4513;
```

## 関連ファイル

- [app/src/lib/diagnosis-scale/scale.ts](../../../app/src/lib/diagnosis-scale/scale.ts)
- [app/src/lib/diagnosis-scale/scoring.ts](../../../app/src/lib/diagnosis-scale/scoring.ts)
- [app/src/lib/diagnosis/machine.ts](../../../app/src/lib/diagnosis/machine.ts)
- [app/src/lib/recommendations/engine.ts](../../../app/src/lib/recommendations/engine.ts)
- [docs/design/personality-matching-redesign.md](../../../docs/design/personality-matching-redesign.md)
- [app/src/app/globals.css](../../../app/src/app/globals.css)
