---
name: volunty-domain-knowledge
description: 'Use when: Volunty の BIG5 特性、10 類型、Participant/Organization/Opportunity/Application/Role 用語、主要 TypeScript 型を確認する必要がある。'
argument-hint: '例: BIG5特性を確認 / 類型名を確認 / ドメイン型を確認 / 用語の意味を確認'
---

# ドメイン知識

## BIG5 特性

各特性は 0-100 スコアで扱う。

| コード | 日本語 | 内容 |
| --- | --- | --- |
| `extraversion` | 外向性 | 社交性・活動性・刺激追求 |
| `agreeableness` | 協調性 | 共感性・協力性・信頼性 |
| `conscientiousness` | 誠実性 | 計画性・責任感・自己統制 |
| `neuroticism` | 神経症傾向 | 感情の不安定性・ストレス耐性 |
| `openness` | 開放性 | 好奇心・創造性・新規性受容 |

## 10 類型

- イノベーター・リーダー
- サポーター・ケア
- クリエイティブ・ソロ
- パーフェクショニスト・アナリスト
- カリスマ・エンターテイナー
- ストラテジスト・プランナー
- ハーモニー・メディエーター
- アドベンチャー・エクスプローラー
- コンサバティブ・ガーディアン
- バランサー・ジェネラリスト

## 用語

- Participant: 参加者
- Organization: 団体
- Opportunity: 募集案件
- Application: 応募
- Role: `participant` / `organization` / `admin`

## 主要型定義

```typescript
type BIG5Trait = 'extraversion' | 'agreeableness' | 'conscientiousness' | 'neuroticism' | 'openness'

interface BIG5Scores {
  extraversion: number
  agreeableness: number
  conscientiousness: number
  neuroticism: number
  openness: number
}

interface PersonalityType {
  id: string
  name: string
  nameEn: string
  criteria: { [trait]: { min?: number; max?: number } }
  priority: number
  description: string
  strengths: string[]
  suitableActivities: string[]
}

interface PersonalityProfile {
  userId: string
  scores: BIG5Scores
  timestamp: string
  personalityType: PersonalityType | null
  closestType: PersonalityType & { distance: number }
}
```

## 関連ファイル

- [app/src/lib/personality/types.ts](../../../app/src/lib/personality/types.ts)
- [app/src/lib/personality/constants.ts](../../../app/src/lib/personality/constants.ts)