---
name: volunty-domain-knowledge
description: 'Use when: Volunty の BIG5 特性、活動スタイル参考タイプ、Participant/Organization/Opportunity/Application/Role 用語、主要 TypeScript 型を確認する必要がある。'
argument-hint: '例: BIG5の定義を確認 / 参考タイプ一覧 / ドメイン型を確認'
---

# ドメイン知識

## BIG5 特性（IPIP Lexical Big-Five Factor Markers 準拠）

raw score はドメイン内10項目の合計（10〜50）、表示用は 0〜100 の換算値（母集団内の位置ではない）。

| コード | 日本語 | 内容 |
| --- | --- | --- |
| `extraversion` | 外向性 | 社交性・活動性・刺激追求 |
| `agreeableness` | 協調性 | 共感性・協力性・信頼性 |
| `conscientiousness` | 誠実性 | 計画性・責任感・自己統制 |
| `emotionalStability` | 情緒安定性 | 気分の安定・ストレス耐性（旧「神経症傾向」の逆方向） |
| `intellect` | 知性・想像性 | 好奇心・想像力・新しい考えの受容（開放性に相当） |

## 活動スタイル参考タイプ（10種）

心理測定の本体ではなく、結果を分かりやすくする補助情報。断定表現（「あなたは◯◯です」）は使わない。

- イノベーター・リーダー / サポーター・ケア / クリエイティブ・ソロ / パーフェクショニスト・アナリスト /
  カリスマ・エンターテイナー / ストラテジスト・プランナー / ハーモニー・メディエーター /
  アドベンチャー・エクスプローラー / コンサバティブ・ガーディアン / センシティブ・アーティスト

定義: `app/src/lib/diagnosis-scale/style-types.ts`（`STYLE_TYPE_VERSION` 管理）

## 活動スタイルタグ（案件側・最大3つ）

団体が案件に設定するタグ。BIG5 ドメインの高低方向にマップされ、マッチングで**加点のみ**に使う
（減点・除外はしない）。定義: `app/src/lib/recommendations/activity-style-tags.ts`

## 用語

- Participant: 参加者
- Organization: 団体
- Opportunity: 募集案件
- Application: 応募
- Role: `participant` / `organization` / `admin`

## 主要型定義

```typescript
type Big5Domain =
  | 'extraversion'
  | 'agreeableness'
  | 'conscientiousness'
  | 'emotionalStability'
  | 'intellect'

type DomainScores = Record<Big5Domain, number>

interface DiagnosisAnswer {
  itemCode: string   // 例: 'ipip-bfm50-e01'
  value: number      // 1-5
  elapsedMs?: number
  changedCount?: number
}

interface ActivityStyleType {
  id: string
  name: string
  description: string       // 傾向としての説明（断定しない）
  tendencies: string[]
  activityExamples: string[]
  profile: DomainScores     // 代表プロファイル（参考分類用）
}
```

## 関連ファイル

- [app/src/lib/diagnosis-scale/types.ts](../../../app/src/lib/diagnosis-scale/types.ts)
- [app/src/lib/diagnosis-scale/scale.ts](../../../app/src/lib/diagnosis-scale/scale.ts)
- [app/src/lib/diagnosis-scale/style-types.ts](../../../app/src/lib/diagnosis-scale/style-types.ts)
- [docs/design/personality-matching-redesign.md](../../../docs/design/personality-matching-redesign.md)
