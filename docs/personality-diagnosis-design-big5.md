# 性格診断アルゴリズム設計書（BIG5版)

## 1. 概要

### 1.1 目的
ボランティア参加者の性格特性を BIG5 理論で診断し、団体との相性を可視化することで、最適なマッチングを実現する。

### 1.2 設計方針
- **Phase 1 (MVP)**: ルールベースの BIG5 診断で基本機能を実装
- **Phase 2**: AI（AWS Bedrock）と協調フィルタリングを組み合わせたハイブリッド推薦
- **Phase 3**: 適応型質問システムによるパーソナライズド診断

### 1.3 診断フレームワーク
**BIG5 (Five Factor Model)** を採用。学術的に最も信頼性が高く、文化横断的な妥当性が実証されている性格理論。MBTI と異なり、連続的なスコアで個人差を捉える。

---

## 2. 診断モデル設計

### 2.1 BIG5 性格特性の 5 次元定義

| 次元           | 英語表記              | 測定内容                     | スコア範囲                  |
| -------------- | --------------------- | ---------------------------- | --------------------------- |
| **外向性**     | Extraversion (E)      | 社交性、活動性、刺激追求     | 0% (内向的) ~ 100% (外向的) |
| **協調性**     | Agreeableness (A)     | 共感性、協力性、信頼性       | 0% (競争的) ~ 100% (協力的) |
| **誠実性**     | Conscientiousness (C) | 計画性、責任感、自己統制     | 0% (柔軟型) ~ 100% (計画型) |
| **神経症傾向** | Neuroticism (N)       | 感情の不安定性、ストレス耐性 | 0% (安定) ~ 100% (敏感)     |
| **開放性**     | Openness (O)          | 好奇心、創造性、新規性受容   | 0% (保守的) ~ 100% (革新的) |

**注記**: 神経症傾向は「情緒安定性 (Emotional Stability)」の逆スコアとしても表現される。

### 2.2 BIG5 × ボランティア人物タイプ分類（10類型）

#### 1. イノベーター・リーダータイプ
**特性プロファイル**: 外向性 85% × 開放性 90% × 誠実性 80%

- **性格**: 新しいアイデアを積極的に提案し、チームを牽引する
- **ボランティアでの強み**: プロジェクトリーダー、企画立案、新規事業開発
- **適した活動**: イベント統括、社会課題の新規アプローチ開発
- **特徴**: 変革を恐れず、計画的に実行できる

#### 2. サポーター・ケアタイプ
**特性プロファイル**: 協調性 90% × 外向性 70% × 神経症傾向 30%（低い）

- **性格**: 他人の感情に敏感で、献身的にサポート
- **ボランティアでの強み**: 高齢者支援、障がい者サポート、傾聴ボランティア
- **適した活動**: 個別相談、継続的な見守り活動
- **特徴**: 安定した精神状態で人を支え続けられる

#### 3. クリエイティブ・ソロタイプ
**特性プロファイル**: 開放性 95% × 外向性 20%（低い） × 誠実性 60%

- **性格**: 独創的なアイデアを一人で深く追求
- **ボランティアでの強み**: デザイン制作、ライティング、動画編集
- **適した活動**: 広報物作成、アート制作、静かな環境での作業
- **特徴**: マイペースに創造性を発揮

#### 4. パーフェクショニスト・アナリストタイプ
**特性プロファイル**: 誠実性 95% × 神経症傾向 70% × 開放性 50%

- **性格**: 細部まで完璧を追求し、高い品質基準を持つ
- **ボランティアでの強み**: データ入力、会計管理、記録作成
- **適した活動**: 精密な作業、品質チェック、ドキュメント整備
- **特徴**: ミスを恐れ、慎重に作業を進める

#### 5. カリスマ・エンターテイナータイプ
**特性プロファイル**: 外向性 95% × 協調性 80% × 開放性 85%

- **性格**: 人を惹きつけ、楽しい雰囲気を作り出す
- **ボランティアでの強み**: 子どもイベント、募金活動、PR 活動
- **適した活動**: ステージ進行、来場者対応、SNS 発信
- **特徴**: 新しい体験を共有し、人々を巻き込む

#### 6. ストラテジスト・プランナータイプ
**特性プロファイル**: 誠実性 90% × 開放性 75% × 神経症傾向 40%（低い）

- **性格**: 長期的視点で戦略を立て、確実に実行
- **ボランティアでの強み**: プロジェクトマネジメント、予算管理、進捗管理
- **適した活動**: 企画全体の設計、リスク管理、成果測定
- **特徴**: 冷静に状況を分析し、革新的な計画を立案

#### 7. ハーモニー・メディエータータイプ
**特性プロファイル**: 協調性 95% × 神経症傾向 35%（低い） × 外向性 60%

- **性格**: 対立を避け、チーム内の調和を重視
- **ボランティアでの強み**: チーム調整、意見とりまとめ、紛争解決
- **適した活動**: ファシリテーション、多様な参加者の橋渡し
- **特徴**: 穏やかに全員の意見をまとめる

#### 8. アドベンチャー・エクスプローラータイプ
**特性プロファイル**: 開放性 90% × 外向性 85% × 神経症傾向 25%（低い）

- **性格**: 新しい経験や冒険を求め、リスクを恐れない
- **ボランティアでの強み**: 屋外活動、被災地支援、海外ボランティア
- **適した活動**: 身体を使う活動、未知の環境への対応
- **特徴**: 未知の領域に積極的に飛び込む

#### 9. コンサバティブ・ガーディアンタイプ
**特性プロファイル**: 誠実性 85% × 協調性 75% × 開放性 30%（低い）

- **性格**: 伝統や規則を重視し、安定を求める
- **ボランティアでの強み**: 定例活動、ルール遵守、安全管理
- **適した活動**: 継続的な地域清掃、伝統行事の運営補助
- **特徴**: 既存のルールを守りながらチームをサポート

#### 10. センシティブ・アーティストタイプ
**特性プロファイル**: 開放性 90% × 神経症傾向 75% × 外向性 35%（低い）

- **性格**: 感受性が豊かで、繊細な表現を得意とする
- **ボランティアでの強み**: 音楽演奏、詩の朗読、アート療法
- **適した活動**: 少人数の穏やかな環境での創作活動
- **特徴**: 内面の感情を深く掘り下げ、作品に昇華

### 2.3 人物タイプ判定ロジック

```typescript
export interface BIG5Scores {
  extraversion: number      // 0-100
  agreeableness: number     // 0-100
  conscientiousness: number // 0-100
  neuroticism: number       // 0-100
  openness: number          // 0-100
}

export interface PersonalityType {
  id: string
  name: string
  nameEn: string
  criteria: {
    extraversion?: { min?: number; max?: number }
    agreeableness?: { min?: number; max?: number }
    conscientiousness?: { min?: number; max?: number }
    neuroticism?: { min?: number; max?: number }
    openness?: { min?: number; max?: number }
  }
  priority: number  // 複数マッチ時の優先順位
  description: string
  strengths: string[]
  suitableActivities: string[]
}

export const PERSONALITY_TYPES: PersonalityType[] = [
  {
    id: 'innovator-leader',
    name: 'イノベーター・リーダータイプ',
    nameEn: 'Innovator Leader',
    criteria: {
      extraversion: { min: 75 },
      openness: { min: 80 },
      conscientiousness: { min: 70 }
    },
    priority: 1,
    description: '新しいアイデアを積極的に提案し、チームを牽引する',
    strengths: ['プロジェクトリーダー', '企画立案', '新規事業開発'],
    suitableActivities: ['イベント統括', '社会課題の新規アプローチ開発']
  },
  {
    id: 'supporter-care',
    name: 'サポーター・ケアタイプ',
    nameEn: 'Supporter Care',
    criteria: {
      agreeableness: { min: 80 },
      extraversion: { min: 60 },
      neuroticism: { max: 40 }
    },
    priority: 2,
    description: '他人の感情に敏感で、献身的にサポート',
    strengths: ['高齢者支援', '障がい者サポート', '傾聴ボランティア'],
    suitableActivities: ['個別相談', '継続的な見守り活動']
  },
  // ... 残り8タイプ
]

/**
 * BIG5 スコアから人物タイプを判定
 */
export function determinePersonalityType(
  scores: BIG5Scores
): PersonalityType | null {
  // 全条件を満たすタイプを抽出
  const matchedTypes = PERSONALITY_TYPES.filter(type => {
    return Object.entries(type.criteria).every(([trait, range]) => {
      const score = scores[trait as keyof BIG5Scores]
      if (range.min !== undefined && score < range.min) return false
      if (range.max !== undefined && score > range.max) return false
      return true
    })
  })
  
  // 優先度が高いものを返す
  return matchedTypes.sort((a, b) => a.priority - b.priority)[0] || null
}

/**
 * 最も近い人物タイプを計算（完全一致しない場合）
 */
export function findClosestPersonalityType(
  scores: BIG5Scores
): PersonalityType & { distance: number } {
  const typesWithDistance = PERSONALITY_TYPES.map(type => {
    // 各特性の中央値を算出
    const idealScores: BIG5Scores = {
      extraversion: getIdealScore(type.criteria.extraversion),
      agreeableness: getIdealScore(type.criteria.agreeableness),
      conscientiousness: getIdealScore(type.criteria.conscientiousness),
      neuroticism: getIdealScore(type.criteria.neuroticism),
      openness: getIdealScore(type.criteria.openness)
    }
    
    // ユークリッド距離を計算
    const distance = Math.sqrt(
      Object.keys(scores).reduce((sum, key) => {
        const diff = scores[key as keyof BIG5Scores] - idealScores[key as keyof BIG5Scores]
        return sum + diff * diff
      }, 0)
    )
    
    return { ...type, distance }
  })
  
  return typesWithDistance.sort((a, b) => a.distance - b.distance)[0]
}

function getIdealScore(range?: { min?: number; max?: number }): number {
  if (!range) return 50
  if (range.min !== undefined && range.max !== undefined) {
    return (range.min + range.max) / 2
  }
  if (range.min !== undefined) return Math.min(range.min + 10, 100)
  if (range.max !== undefined) return Math.max(range.max - 10, 0)
  return 50
}
```

---

## 3. Phase 1: MVP 実装（ルールベース診断）

### 3.1 データモデル

```typescript
// types/personality.ts
export type BIG5Trait = 
  | 'extraversion'
  | 'agreeableness'
  | 'conscientiousness'
  | 'neuroticism'
  | 'openness'

export interface Question {
  id: string
  text: string
  trait: BIG5Trait
  reversed: boolean  // 逆転項目（「いいえ」が高スコア）
  options: Array<{
    label: string
    value: number  // 1-5 のリッカート尺度
  }>
}

export interface QuestionAnswer {
  questionId: string
  value: number  // 1-5
  timestamp: string
}

export interface PersonalityProfile {
  userId: string
  scores: BIG5Scores
  personalityType: PersonalityType | null
  closestType: PersonalityType & { distance: number }
  timestamp: string
}
```

### 3.2 質問項目設計（50問セット例）

BIG5 の各特性について 10 問ずつ、合計 50 問を用意。

```typescript
export const BIG5_QUESTIONS: Question[] = [
  // 外向性 (Extraversion) - 10問
  {
    id: 'e1',
    text: '初対面の人とも気軽に話しかけることができる',
    trait: 'extraversion',
    reversed: false,
    options: [
      { label: '全く当てはまらない', value: 1 },
      { label: 'あまり当てはまらない', value: 2 },
      { label: 'どちらともいえない', value: 3 },
      { label: 'やや当てはまる', value: 4 },
      { label: '非常に当てはまる', value: 5 }
    ]
  },
  {
    id: 'e2',
    text: '大勢の前で話すのは苦手だ',
    trait: 'extraversion',
    reversed: true,  // 逆転項目
    options: [/* 同上 */]
  },
  
  // 協調性 (Agreeableness) - 10問
  {
    id: 'a1',
    text: '他人の気持ちを理解しようと努める',
    trait: 'agreeableness',
    reversed: false,
    options: [/* 同上 */]
  },
  
  // 誠実性 (Conscientiousness) - 10問
  {
    id: 'c1',
    text: '計画を立ててから行動することが多い',
    trait: 'conscientiousness',
    reversed: false,
    options: [/* 同上 */]
  },
  
  // 神経症傾向 (Neuroticism) - 10問
  {
    id: 'n1',
    text: '小さなことでも心配してしまう',
    trait: 'neuroticism',
    reversed: false,
    options: [/* 同上 */]
  },
  
  // 開放性 (Openness) - 10問
  {
    id: 'o1',
    text: '新しいアイデアや経験を求める',
    trait: 'openness',
    reversed: false,
    options: [/* 同上 */]
  }
]
```

### 3.3 診断フロー（XState）

```typescript
// machines/diagnosisMachine.ts
import { createMachine, assign } from 'xstate'

export const diagnosisMachine = createMachine({
  id: 'big5-diagnosis',
  initial: 'idle',
  context: {
    currentQuestionIndex: 0,
    answers: [] as QuestionAnswer[],
    result: null as PersonalityProfile | null
  },
  states: {
    idle: {
      on: { START: 'answering' }
    },
    answering: {
      on: {
        ANSWER: {
          actions: assign({
            answers: (ctx, evt) => [
              ...ctx.answers,
              {
                questionId: BIG5_QUESTIONS[ctx.currentQuestionIndex].id,
                value: evt.value,
                timestamp: new Date().toISOString()
              }
            ],
            currentQuestionIndex: (ctx) => ctx.currentQuestionIndex + 1
          }),
          target: 'checkProgress'
        },
        BACK: {
          actions: assign({
            currentQuestionIndex: (ctx) => Math.max(0, ctx.currentQuestionIndex - 1),
            answers: (ctx) => ctx.answers.slice(0, -1)
          }),
          target: 'answering'
        }
      }
    },
    checkProgress: {
      always: [
        { target: 'calculating', cond: 'isComplete' },
        { target: 'answering' }
      ]
    },
    calculating: {
      invoke: {
        src: 'calculateBIG5Result',
        onDone: {
          target: 'completed',
          actions: assign({ result: (_, evt) => evt.data })
        },
        onError: 'error'
      }
    },
    completed: { type: 'final' },
    error: {}
  }
}, {
  guards: {
    isComplete: (ctx) => ctx.currentQuestionIndex >= BIG5_QUESTIONS.length
  },
  services: {
    calculateBIG5Result: async (ctx) => await calculateBIG5Diagnosis(ctx.answers)
  }
})
```

### 3.4 スコア計算ロジック

```typescript
// services/diagnosisService.ts
export async function calculateBIG5Diagnosis(
  answers: QuestionAnswer[]
): Promise<PersonalityProfile> {
  const traitScores: Record<BIG5Trait, number[]> = {
    extraversion: [],
    agreeableness: [],
    conscientiousness: [],
    neuroticism: [],
    openness: []
  }
  
  // 各回答を対応する特性に振り分け
  answers.forEach(answer => {
    const question = BIG5_QUESTIONS.find(q => q.id === answer.questionId)
    if (!question) return
    
    // 逆転項目の処理
    const score = question.reversed ? (6 - answer.value) : answer.value
    traitScores[question.trait].push(score)
  })
  
  // 各特性の平均を算出し、0-100 に正規化
  const scores: BIG5Scores = {
    extraversion: normalize(average(traitScores.extraversion)),
    agreeableness: normalize(average(traitScores.agreeableness)),
    conscientiousness: normalize(average(traitScores.conscientiousness)),
    neuroticism: normalize(average(traitScores.neuroticism)),
    openness: normalize(average(traitScores.openness))
  }
  
  // 人物タイプ判定
  const personalityType = determinePersonalityType(scores)
  const closestType = findClosestPersonalityType(scores)
  
  return {
    userId: 'current-user',  // 実装時はセッションから取得
    scores,
    personalityType,
    closestType,
    timestamp: new Date().toISOString()
  }
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function normalize(score: number): number {
  // 1-5 のスコアを 0-100 に変換
  return ((score - 1) / 4) * 100
}
```

### 3.5 基本マッチングスコア

```typescript
// services/matchingService.ts
export interface OrganizationPreference {
  id: string
  idealProfile: BIG5Scores
  weights?: Partial<Record<BIG5Trait, number>>  // 各特性の重要度
}

export function calculateMatchScore(
  userProfile: BIG5Scores,
  orgPreference: OrganizationPreference
): number {
  const traits: BIG5Trait[] = [
    'extraversion',
    'agreeableness',
    'conscientiousness',
    'neuroticism',
    'openness'
  ]
  
  // デフォルトの重みは均等
  const defaultWeights = {
    extraversion: 1.0,
    agreeableness: 1.0,
    conscientiousness: 1.0,
    neuroticism: 1.0,
    openness: 1.0
  }
  
  const weights = { ...defaultWeights, ...orgPreference.weights }
  
  // 重み付きユークリッド距離を計算
  const weightedDistance = Math.sqrt(
    traits.reduce((sum, trait) => {
      const diff = userProfile[trait] - orgPreference.idealProfile[trait]
      return sum + (diff * diff * weights[trait])
    }, 0)
  )
  
  // 0-100 のスコアに正規化
  // 最大距離は √(100² × 5) = 223.6（重み1の場合）
  const maxDistance = Math.sqrt(100 * 100 * 5)
  return Math.max(0, 100 - (weightedDistance / maxDistance) * 100)
}

/**
 * 団体の求める人物像を登録
 */
export async function setOrganizationPreference(
  orgId: string,
  idealProfile: BIG5Scores,
  weights?: Partial<Record<BIG5Trait, number>>
): Promise<OrganizationPreference> {
  // DB に保存
  const preference: OrganizationPreference = {
    id: orgId,
    idealProfile,
    weights
  }
  
  await db.organizationPreferences.upsert({
    where: { orgId },
    update: preference,
    create: preference
  })
  
  return preference
}
```

---

## 4. Phase 2: ハイブリッド AI 推薦

### 4.1 アーキテクチャ概要

```
┌─────────────────────────────────────────────┐
│       ユーザーBIG5診断結果                   │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
   ┌────────┐ ┌──────┐ ┌────────┐
   │ルール  │ │協調  │ │AI解説  │
   │ベース  │ │フィル│ │生成    │
   │スコア  │ │タ    │ │(Bedrock)│
   └────┬───┘ └───┬──┘ └───┬────┘
        │         │        │
        └─────────┼────────┘
                  ▼
        ┌──────────────────┐
        │ 重み付け統合      │
        │ (40% + 40% + 20%)│
        └─────────┬────────┘
                  ▼
        ┌──────────────────┐
        │ 最終推薦リスト    │
        └──────────────────┘
```

### 4.2 AWS Bedrock による診断解説生成

```typescript
// services/ai/bedrockDiagnosisService.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

interface AIEnhancedResult {
  personalityProfile: PersonalityProfile
  aiInsights: {
    summary: string          // 人柄の要約
    recommendations: string[] // 適した活動
    tips: string             // 活動時のアドバイス
    strengthsDetail: string  // 強みの詳細分析
  }
}

export async function enhanceBIG5DiagnosisWithAI(
  profile: PersonalityProfile
): Promise<AIEnhancedResult> {
  const client = new BedrockRuntimeClient({ region: 'ap-northeast-1' })
  
  const prompt = `
あなたはボランティアマッチングの専門家です。以下のBIG5診断結果から、この人の特徴と適した活動を提案してください。

## BIG5診断結果
- 外向性 (Extraversion): ${profile.scores.extraversion}% ${getTraitDescription('extraversion', profile.scores.extraversion)}
- 協調性 (Agreeableness): ${profile.scores.agreeableness}% ${getTraitDescription('agreeableness', profile.scores.agreeableness)}
- 誠実性 (Conscientiousness): ${profile.scores.conscientiousness}% ${getTraitDescription('conscientiousness', profile.scores.conscientiousness)}
- 神経症傾向 (Neuroticism): ${profile.scores.neuroticism}% ${getTraitDescription('neuroticism', profile.scores.neuroticism)}
- 開放性 (Openness): ${profile.scores.openness}% ${getTraitDescription('openness', profile.scores.openness)}

## 判定された人物タイプ
${profile.personalityType?.name || profile.closestType.name}

以下のJSON形式で出力してください：
{
  "summary": "この人の特徴を2〜3文で",
  "recommendations": ["適した活動1", "適した活動2", "適した活動3"],
  "tips": "活動時に意識すると良いポイント（100文字程度）",
  "strengthsDetail": "このタイプならではの強みの詳細（150文字程度）"
}
`

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  
  const response = await client.send(command)
  const result = JSON.parse(new TextDecoder().decode(response.body))
  const aiInsights = JSON.parse(result.content[0].text)
  
  return { personalityProfile: profile, aiInsights }
}

function getTraitDescription(trait: BIG5Trait, score: number): string {
  const descriptions = {
    extraversion: score > 60 ? '(外向的)' : score < 40 ? '(内向的)' : '(中間)',
    agreeableness: score > 60 ? '(協力的)' : score < 40 ? '(競争的)' : '(中間)',
    conscientiousness: score > 60 ? '(計画的)' : score < 40 ? '(柔軟)' : '(中間)',
    neuroticism: score > 60 ? '(敏感)' : score < 40 ? '(安定)' : '(中間)',
    openness: score > 60 ? '(革新的)' : score < 40 ? '(保守的)' : '(中間)'
  }
  return descriptions[trait]
}
```

### 4.3 協調フィルタリング

```typescript
// services/ai/collaborativeFilteringService.ts
import * as tf from '@tensorflow/tfjs-node'

interface UserActivityHistory {
  userId: string
  big5Scores: BIG5Scores
  appliedOrgs: string[]
  completedOrgs: string[]
  ratings: Map<string, number>  // 団体への満足度 (1-5)
}

export class BIG5CollaborativeFilteringEngine {
  private userEmbeddings: tf.Tensor2D | null = null
  private orgEmbeddings: tf.Tensor2D | null = null
  
  async train(histories: UserActivityHistory[]) {
    // BIG5スコアを特徴量として使用
    const userFeatures = histories.map(h => [
      h.big5Scores.extraversion / 100,
      h.big5Scores.agreeableness / 100,
      h.big5Scores.conscientiousness / 100,
      h.big5Scores.neuroticism / 100,
      h.big5Scores.openness / 100
    ])
    
    const userTensor = tf.tensor2d(userFeatures)
    
    const { userEmbed, orgEmbed } = await this.matrixFactorization(
      userTensor,
      histories
    )
    
    this.userEmbeddings = userEmbed
    this.orgEmbeddings = orgEmbed
  }
  
  async recommendOrganizations(
    profile: BIG5Scores,
    topK = 10
  ): Promise<Array<{ orgId: string; score: number }>> {
    if (!this.userEmbeddings || !this.orgEmbeddings) {
      throw new Error('Model not trained')
    }
    
    const userVector = tf.tensor2d([[
      profile.extraversion / 100,
      profile.agreeableness / 100,
      profile.conscientiousness / 100,
      profile.neuroticism / 100,
      profile.openness / 100
    ]])
    
    // コサイン類似度で推薦
    const similarities = tf.matMul(userVector, this.orgEmbeddings, false, true)
    const scores = await similarities.data()
    
    return Array.from(scores)
      .map((score, idx) => ({ orgId: `org_${idx}`, score: score * 100 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
  
  private async matrixFactorization(
    userTensor: tf.Tensor2D,
    histories: UserActivityHistory[]
  ) {
    // TensorFlow.js による Matrix Factorization 実装
    // 詳細はバックエンド実装時に追記
    return { userEmbed: userTensor, orgEmbed: userTensor }
  }
}
```

### 4.4 ハイブリッド統合

```typescript
// services/matchingService.ts
export interface RecommendedOrganization {
  id: string
  name: string
  category: string[]
  matchScore: number
  breakdown: {
    ruleBasedScore: number
    collaborativeScore: number
    aiBoost: number
  }
  aiInsights?: AIEnhancedResult['aiInsights']
}

export async function getRecommendations(
  profile: PersonalityProfile,
  userId: string
): Promise<RecommendedOrganization[]> {
  // 1. ルールベースのスコアリング
  const organizations = await fetchOrganizations()
  const ruleBasedScores = new Map<string, number>()
  
  for (const org of organizations) {
    const orgPreference = await getOrganizationPreference(org.id)
    if (orgPreference) {
      const score = calculateMatchScore(profile.scores, orgPreference)
      ruleBasedScores.set(org.id, score)
    }
  }
  
  // 2. 協調フィルタリングのスコア
  const cfEngine = new BIG5CollaborativeFilteringEngine()
  await cfEngine.train(await fetchUserHistories())
  const cfScores = await cfEngine.recommendOrganizations(profile.scores)
  const cfScoreMap = new Map(cfScores.map(s => [s.orgId, s.score]))
  
  // 3. AI による追加フィルタ
  const aiEnhanced = await enhanceBIG5DiagnosisWithAI(profile)
  
  // 4. 重み付け統合（40% + 40% + 20%）
  const finalScores: RecommendedOrganization[] = organizations.map(org => {
    const ruleScore = ruleBasedScores.get(org.id) ?? 0
    const cfScore = cfScoreMap.get(org.id) ?? 0
    const aiBoost = aiEnhanced.aiInsights.recommendations
      .some(rec => org.category.some(cat => cat.includes(rec))) ? 10 : 0
    
    return {
      id: org.id,
      name: org.name,
      category: org.category,
      matchScore: (ruleScore * 0.4) + (cfScore * 0.4) + (aiBoost * 0.2),
      breakdown: {
        ruleBasedScore: ruleScore,
        collaborativeScore: cfScore,
        aiBoost
      },
      aiInsights: aiEnhanced.aiInsights
    }
  })
  
  return finalScores
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20)
}
```

---

## 5. データ収集とフィードバックループ

### 5.1 収集するデータ

```typescript
// types/analytics.ts
export interface BIG5DiagnosisEvent {
  userId: string
  timestamp: string
  diagnosisResult: BIG5Scores
  personalityType: string
  answers: QuestionAnswer[]
}

export interface MatchingEvent {
  userId: string
  orgId: string
  matchScore: number
  breakdown: {
    ruleBasedScore: number
    collaborativeScore: number
    aiBoost: number
  }
  method: 'rule-based' | 'collaborative' | 'ai-enhanced' | 'hybrid'
  timestamp: string
}

export interface ApplicationEvent {
  userId: string
  orgId: string
  applied: boolean
  completed?: boolean
  rating?: number  // 1-5
  feedback?: string
  timestamp: string
}
```

### 5.2 KPI 定義

| KPI              | 説明                     | 目標値       |
| ---------------- | ------------------------ | ------------ |
| **診断完了率**   | 開始 → 完了の割合        | 80% 以上     |
| **応募転換率**   | 診断完了 → 応募の割合    | 30% 以上     |
| **参加完了率**   | 応募 → 参加完了の割合    | 70% 以上     |
| **満足度スコア** | 参加後の評価平均         | 4.0/5.0 以上 |
| **推薦精度**     | Top-10 に応募した割合    | 60% 以上     |
| **特性別適合率** | 各 BIG5 次元での予測精度 | 各 70% 以上  |

---

## 6. 実装ロードマップ

### MVP（2週間）
- ✅ ルールベースの BIG5 診断（50問）
- ✅ 10 人物タイプの判定ロジック
- ✅ 基本的なマッチングスコア計算
- ✅ XState による診断フロー
- ✅ UI コンポーネント実装

### Phase 2A（1ヶ月）
- ✅ AWS Bedrock 統合
- ✅ 診断結果の AI 解説生成
- ✅ BIG5 スコアの可視化（レーダーチャート）
- ✅ ユーザー行動ログ収集開始

### Phase 2B（2ヶ月）
- ✅ 協調フィルタリングモデルの構築
- ✅ ハイブリッド推薦システム
- ✅ A/B テストフレームワーク
- ✅ 推薦精度の評価指標確立

### Phase 3（3ヶ月〜）
- ✅ 適応型質問システム（回答に応じて質問変更）
- ✅ リアルタイム学習
- ✅ 団体向け AI インサイト生成
- ✅ BIG5 特性別の詳細レポート

---

## 7. コスト試算

### AWS Bedrock（Claude 3 Haiku）
- 入力: $0.00025 / 1K tokens
- 出力: $0.00125 / 1K tokens
- **1回の診断強化**: 約 600 tokens → **¥0.12 未満**

### TensorFlow.js（協調フィルタリング）
- AWS Lambda での推論実行
- **1回の推薦**: 約 100ms → **¥0.01 未満**

### 月間コスト試算（1,000 ユーザー想定）
- Bedrock: ¥120
- Lambda: ¥10
- **合計: ¥130/月 程度**

---

## 8. テスト戦略

### 8.1 ユニットテスト

```typescript
// __tests__/big5DiagnosisService.test.ts
import { describe, it, expect } from 'vitest'
import { calculateBIG5Diagnosis, determinePersonalityType } from '@/services/diagnosisService'

describe('calculateBIG5Diagnosis', () => {
  it('全て最高評価なら各特性が100%になる', async () => {
    const answers: QuestionAnswer[] = BIG5_QUESTIONS.map((q, idx) => ({
      questionId: q.id,
      value: q.reversed ? 1 : 5,
      timestamp: new Date().toISOString()
    }))
    
    const result = await calculateBIG5Diagnosis(answers)
    expect(result.scores.extraversion).toBeCloseTo(100, 1)
    expect(result.scores.openness).toBeCloseTo(100, 1)
  })
  
  it('イノベーター・リーダータイプが正しく判定される', () => {
    const scores: BIG5Scores = {
      extraversion: 90,
      agreeableness: 60,
      conscientiousness: 85,
      neuroticism: 30,
      openness: 95
    }
    
    const type = determinePersonalityType(scores)
    expect(type?.id).toBe('innovator-leader')
  })
})
```

### 8.2 統合テスト

```typescript
// __tests__/matchingService.test.ts
describe('getRecommendations (Hybrid)', () => {
  it('3つのスコアが統合される', async () => {
    const profile = createMockBIG5Profile()
    const recommendations = await getRecommendations(profile, 'user123')
    
    expect(recommendations).toHaveLength(20)
    expect(recommendations[0].matchScore).toBeGreaterThan(0)
    expect(recommendations[0].breakdown).toHaveProperty('ruleBasedScore')
    expect(recommendations[0].breakdown).toHaveProperty('collaborativeScore')
    expect(recommendations[0].aiInsights).toBeDefined()
  })
})
```

### 8.3 A/B テスト設計

| グループ | アルゴリズム           | 期間  | 評価指標           |
| -------- | ---------------------- | ----- | ------------------ |
| A        | ルールベースのみ       | 2週間 | 応募転換率、満足度 |
| B        | ハイブリッド (Phase 2) | 2週間 | 応募転換率、満足度 |

---

## 9. 今後の課題

### 9.1 技術的課題
- バックエンド API 設計（NestJS/Serverless 等）
- BIG5 診断質問の日本語妥当性検証
- 協調フィルタリングのコールドスタート問題対策
- 診断結果の長期的変化追跡

### 9.2 運用課題
- 診断質問の定期的な見直し
- AI 生成結果の品質モニタリング
- プライバシー・倫理ガイドライン策定
- 団体向けオンボーディング設計

### 9.3 機能拡張候補
- 団体向け「求める人物像」診断
- 過去参加者のフィードバック分析
- BIG5 スコアの経年変化追跡
- チーム編成最適化アルゴリズム

---

## 10. 参考文献・リンク

- [BIG5 理論の概要 (Wikipedia)](https://ja.wikipedia.org/wiki/ビッグファイブ_(心理学))
- [International Personality Item Pool (IPIP)](https://ipip.ori.org/) - オープンソースのBIG5質問項目
- [AWS Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [TensorFlow.js 公式ガイド](https://www.tensorflow.org/js)
- [XState ドキュメント](https://xstate.js.org/)

---

**更新履歴**:
- 2025-11-08: BIG5 ベースに全面リニューアル（MBTI から移行）
- 2025-10-22: 初版作成（MBTI版）
