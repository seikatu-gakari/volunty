# 性格診断アルゴリズム設計書

## 1. 概要

### 1.1 目的
ボランティア参加者の性格特性を診断し、団体との相性を可視化することで、最適なマッチングを実現する。

### 1.2 設計方針
- **Phase 1 (MVP)**: ルールベースの 4 軸診断で基本機能を実装
- **Phase 2**: AI（AWS Bedrock）と協調フィルタリングを組み合わせたハイブリッド推薦
- **Phase 3**: 適応型質問システムによるパーソナライズド診断

### 1.3 参考フレームワーク
MBTI (Myers-Briggs Type Indicator) の 4 軸理論をベースに、ボランティア活動に特化したカスタマイズを実施。

---

## 2. 診断モデル設計

### 2.1 性格診断の 4 軸定義

| 軸名 | 英語表記 | 測定内容 | スコア範囲 |
|---|---|---|---|
| **社交性** | Social | 外向(E) ↔ 内向(I) | -100 (内向的) ~ +100 (外向的) |
| **タスク志向** | TaskStyle | 実践型(S) ↔ ビジョン型(N) | -100 (実践型) ~ +100 (ビジョン型) |
| **意思決定** | Decision | 論理(T) ↔ 共感(F) | -100 (論理型) ~ +100 (共感型) |
| **計画性** | Planning | 柔軟(P) ↔ 構造化(J) | -100 (柔軟型) ~ +100 (構造型) |

### 2.2 MBTI 16 タイプ → ボランティア人柄分類

#### アナリスト群 (NT型) - 戦略・改善を得意とする

| MBTI | 人柄分類 | 特徴 | ボランティアでの強み |
|---|---|---|---|
| INTJ | 戦略設計タイプ | 長期計画を立て、効率化を追求 | プロジェクト全体の最適化、課題分析 |
| INTP | 問題解決タイプ | 論理的に仕組みを理解・改善 | システム構築、技術サポート |
| ENTJ | リーダーシップタイプ | 目標達成に向けチームを牽引 | イベント統括、意思決定 |
| ENTP | アイデアマンタイプ | 新しい企画や方法を次々提案 | 企画立案、柔軟な対応 |

#### 外交官群 (NF型) - 人と理念を重視する

| MBTI | 人柄分類 | 特徴 | ボランティアでの強み |
|---|---|---|---|
| INFJ | ビジョン共有タイプ | 理念を体現し、人を導く | 価値観の言語化、長期的な関係構築 |
| INFP | 共感サポートタイプ | 個々の想いに寄り添う | カウンセリング、クリエイティブ表現 |
| ENFJ | 盛り上げ役タイプ | 場を活性化し、チームを鼓舞 | ファシリテーション、モチベーション向上 |
| ENFP | ムードメーカータイプ | 明るく人を巻き込む | 参加者勧誘、雰囲気づくり |

#### 番人群 (SJ型) - 秩序と責任を重んじる

| MBTI | 人柄分類 | 特徴 | ボランティアでの強み |
|---|---|---|---|
| ISTJ | コツコツ作業タイプ | 正確に淡々とタスクをこなす | データ入力、在庫管理、記録作成 |
| ISFJ | 縁の下の力持ちタイプ | 献身的にサポートを続ける | 受付対応、細やかな配慮 |
| ESTJ | 仕切り役タイプ | ルールを守らせ、進行を管理 | タイムキーパー、ルール周知 |
| ESFJ | おもてなしタイプ | 人を歓迎し、快適な環境を作る | 来場者対応、チーム調整 |

#### 探検家群 (SP型) - 柔軟性と行動力がある

| MBTI | 人柄分類 | 特徴 | ボランティアでの強み |
|---|---|---|---|
| ISTP | 技術対応タイプ | 即座に問題を解決 | 機材トラブル対応、現場修理 |
| ISFP | 自由表現タイプ | マイペースに創作活動 | アート制作、自然体での交流 |
| ESTP | 現場対応タイプ | 臨機応変に動き回る | イベント当日の緊急対応、力仕事 |
| ESFP | エンターテイナータイプ | その場を楽しく演出 | パフォーマンス、子ども対応 |

### 2.3 簡易ラベル分類（実装推奨）

16 タイプの厳密な分類は複雑なため、**4 軸 × 3 レベル**で代表的なラベルを付与する方式を採用。

```typescript
export const PERSONALITY_LABELS = {
  // 社交性軸
  'highly-social': '盛り上げ役',
  'moderately-social': 'バランス型',
  'independent': 'マイペース型',
  
  // タスク志向軸
  'detail-oriented': 'コツコツ作業型',
  'balanced-task': '柔軟対応型',
  'visionary': 'アイデアマン型',
  
  // 意思決定軸
  'logical': '問題解決型',
  'balanced-decision': '調整役',
  'empathetic': '共感サポート型',
  
  // 計画性軸
  'structured': '仕切り役',
  'adaptable': '臨機応変型',
  'spontaneous': '自由行動型'
} as const
```

---

## 3. Phase 1: MVP 実装（ルールベース診断）

### 3.1 データモデル

```typescript
// types/personality.ts
export type PersonalityAxis = 
  | 'social'      // 社交性
  | 'taskStyle'   // タスク志向
  | 'decision'    // 意思決定
  | 'planning'    // 計画性

export interface Question {
  id: string
  text: string
  axis: PersonalityAxis
  options: Array<{
    label: string
    weight: number  // -2, -1, 0, +1, +2
  }>
}

export interface DiagnosisResult {
  social: number      // -100 ~ +100
  taskStyle: number
  decision: number
  planning: number
  mbtiType?: string   // 例: "ENFP"
}

export interface PersonalityProfile {
  scores: DiagnosisResult
  primaryLabels: string[]  // 最大3つの代表ラベル
  timestamp: string
}
```

### 3.2 診断フロー（XState）

```typescript
// machines/diagnosisMachine.ts
import { createMachine, assign } from 'xstate'

export const diagnosisMachine = createMachine({
  id: 'diagnosis',
  initial: 'idle',
  context: {
    currentQuestionIndex: 0,
    answers: [] as number[],
    result: null as DiagnosisResult | null
  },
  states: {
    idle: {
      on: { START: 'answering' }
    },
    answering: {
      on: {
        ANSWER: {
          actions: assign({
            answers: (ctx, evt) => [...ctx.answers, evt.value],
            currentQuestionIndex: (ctx) => ctx.currentQuestionIndex + 1
          }),
          target: 'checkProgress'
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
        src: 'calculateResult',
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
    isComplete: (ctx) => ctx.currentQuestionIndex >= QUESTIONS.length
  },
  services: {
    calculateResult: async (ctx) => await calculateDiagnosis(ctx.answers)
  }
})
```

### 3.3 スコア計算ロジック

```typescript
// services/diagnosisService.ts
export async function calculateDiagnosis(
  answers: number[]
): Promise<DiagnosisResult> {
  const scores = { social: 0, taskStyle: 0, decision: 0, planning: 0 }
  
  QUESTIONS.forEach((q, idx) => {
    scores[q.axis] += answers[idx]
  })
  
  // 正規化: -100 ~ +100
  Object.keys(scores).forEach(key => {
    const axisKey = key as PersonalityAxis
    const questionCount = QUESTIONS.filter(q => q.axis === axisKey).length
    scores[axisKey] = (scores[axisKey] / questionCount) * 100
  })
  
  // MBTI タイプ判定
  const mbtiType = [
    scores.social > 0 ? 'E' : 'I',
    scores.taskStyle > 0 ? 'N' : 'S',
    scores.decision > 0 ? 'F' : 'T',
    scores.planning > 0 ? 'J' : 'P'
  ].join('')
  
  return { ...scores, mbtiType }
}
```

### 3.4 基本マッチングスコア

```typescript
// services/matchingService.ts
export function calculateMatchScore(
  userProfile: DiagnosisResult,
  organizationPreference: DiagnosisResult
): number {
  const axes: PersonalityAxis[] = ['social', 'taskStyle', 'decision', 'planning']
  
  // ユークリッド距離を計算
  const distance = Math.sqrt(
    axes.reduce((sum, axis) => {
      const diff = userProfile[axis] - organizationPreference[axis]
      return sum + diff * diff
    }, 0)
  )
  
  // 0-100 のスコアに正規化
  const maxDistance = 200 * Math.sqrt(4)
  return Math.max(0, 100 - (distance / maxDistance) * 100)
}
```

---

## 4. Phase 2: ハイブリッド AI 推薦（アプローチC）

### 4.1 アーキテクチャ概要

```
┌─────────────────────────────────────────────┐
│         ユーザー診断結果                      │
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
  }
}

export async function enhanceDiagnosisWithAI(
  profile: PersonalityProfile,
  answers: QuestionAnswer[]
): Promise<AIEnhancedResult> {
  const client = new BedrockRuntimeClient({ region: 'ap-northeast-1' })
  
  const prompt = `
あなたはボランティアマッチングの専門家です。以下の診断結果から、この人の特徴と適した活動を提案してください。

## 診断結果
- 社交性: ${profile.scores.social} (-100が内向的、+100が外向的)
- タスク志向: ${profile.scores.taskStyle} (-100が実践型、+100がビジョン型)
- 意思決定: ${profile.scores.decision} (-100が論理型、+100が共感型)
- 計画性: ${profile.scores.planning} (-100が柔軟型、+100が構造型)

## 自由回答（抜粋）
${answers.filter(a => a.freeText).map(a => `Q: ${a.questionText}\nA: ${a.freeText}`).join('\n\n')}

以下のJSON形式で出力してください：
{
  "summary": "この人の特徴を1〜2文で",
  "recommendations": ["適した活動1", "適した活動2", "適した活動3"],
  "tips": "活動時に意識すると良いポイント"
}
`

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  
  const response = await client.send(command)
  const result = JSON.parse(new TextDecoder().decode(response.body))
  const aiInsights = JSON.parse(result.content[0].text)
  
  return { personalityProfile: profile, aiInsights }
}
```

### 4.3 協調フィルタリング

```typescript
// services/ai/collaborativeFilteringService.ts
import * as tf from '@tensorflow/tfjs-node'

interface UserActivityHistory {
  userId: string
  personalityScores: number[]  // [social, taskStyle, decision, planning]
  appliedOrgs: string[]
  completedOrgs: string[]
  ratings: Map<string, number>  // 団体への満足度 (1-5)
}

export class CollaborativeFilteringEngine {
  private userEmbeddings: tf.Tensor2D | null = null
  private orgEmbeddings: tf.Tensor2D | null = null
  
  async train(histories: UserActivityHistory[]) {
    // Matrix Factorization で低次元埋め込みを学習
    const userFeatures = histories.map(h => h.personalityScores)
    const userTensor = tf.tensor2d(userFeatures)
    
    const { userEmbed, orgEmbed } = await this.matrixFactorization(
      userTensor,
      histories
    )
    
    this.userEmbeddings = userEmbed
    this.orgEmbeddings = orgEmbed
  }
  
  async recommendOrganizations(
    profile: PersonalityProfile,
    topK = 10
  ): Promise<Array<{ orgId: string; score: number }>> {
    if (!this.userEmbeddings || !this.orgEmbeddings) {
      throw new Error('Model not trained')
    }
    
    const userVector = tf.tensor2d([[
      profile.scores.social,
      profile.scores.taskStyle,
      profile.scores.decision,
      profile.scores.planning
    ]])
    
    // コサイン類似度で推薦
    const similarities = tf.matMul(userVector, this.orgEmbeddings, false, true)
    const scores = await similarities.data()
    
    return Array.from(scores)
      .map((score, idx) => ({ orgId: `org_${idx}`, score }))
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
export async function getRecommendations(
  profile: PersonalityProfile,
  userId: string
): Promise<RecommendedOrganization[]> {
  // 1. ルールベースのスコアリング
  const ruleBasedScores = await calculateRuleBasedScores(profile)
  
  // 2. 協調フィルタリングのスコア
  const cfEngine = new CollaborativeFilteringEngine()
  const cfScores = await cfEngine.recommendOrganizations(profile)
  
  // 3. AI による追加フィルタ
  const aiEnhanced = await enhanceDiagnosisWithAI(profile, [])
  
  // 4. 重み付け統合（40% + 40% + 20%）
  const finalScores = organizations.map(org => {
    const ruleScore = ruleBasedScores.get(org.id) ?? 0
    const cfScore = cfScores.find(s => s.orgId === org.id)?.score ?? 0
    const aiBoost = aiEnhanced.aiInsights.recommendations
      .some(rec => org.category.includes(rec)) ? 10 : 0
    
    return {
      ...org,
      matchScore: (ruleScore * 0.4) + (cfScore * 0.4) + (aiBoost * 0.2),
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
export interface DiagnosisEvent {
  userId: string
  timestamp: string
  diagnosisResult: DiagnosisResult
  answers: QuestionAnswer[]
}

export interface MatchingEvent {
  userId: string
  orgId: string
  matchScore: number
  method: 'rule-based' | 'collaborative' | 'ai-enhanced'
  timestamp: string
}

export interface ApplicationEvent {
  userId: string
  orgId: string
  applied: boolean
  completed?: boolean
  rating?: number  // 1-5
  timestamp: string
}
```

### 5.2 KPI 定義

| KPI | 説明 | 目標値 |
|---|---|---|
| **診断完了率** | 開始 → 完了の割合 | 80% 以上 |
| **応募転換率** | 診断完了 → 応募の割合 | 30% 以上 |
| **参加完了率** | 応募 → 参加完了の割合 | 70% 以上 |
| **満足度スコア** | 参加後の評価平均 | 4.0/5.0 以上 |
| **推薦精度** | Top-10 に応募した割合 | 60% 以上 |

---

## 6. 実装ロードマップ

### MVP（2週間）
- ✅ ルールベースの 4 軸診断
- ✅ 固定質問 15〜20 問
- ✅ 基本的なマッチングスコア計算
- ✅ XState による診断フロー

### Phase 2A（1ヶ月）
- ✅ AWS Bedrock 統合
- ✅ 診断結果の AI 解説生成
- ✅ 自由記述回答の分析
- ✅ ユーザー行動ログ収集開始

### Phase 2B（2ヶ月）
- ✅ 協調フィルタリングモデルの構築
- ✅ ハイブリッド推薦システム（アプローチC）
- ✅ A/B テストフレームワーク
- ✅ 推薦精度の評価指標確立

### Phase 3（3ヶ月〜）
- ✅ 適応型質問システム
- ✅ リアルタイム学習
- ✅ 団体向け AI インサイト生成

---

## 7. コスト試算

### AWS Bedrock（Claude 3 Haiku）
- 入力: $0.00025 / 1K tokens
- 出力: $0.00125 / 1K tokens
- **1回の診断強化**: 約 500 tokens → **¥0.1 未満**

### TensorFlow.js（協調フィルタリング）
- AWS Lambda での推論実行
- **1回の推薦**: 約 100ms → **¥0.01 未満**

### 月間コスト試算（1,000 ユーザー想定）
- Bedrock: ¥100
- Lambda: ¥10
- **合計: ¥110/月 程度**

---

## 8. テスト戦略

### 8.1 ユニットテスト

```typescript
// __tests__/diagnosisService.test.ts
import { describe, it, expect } from 'vitest'
import { calculateDiagnosis } from '@/services/diagnosisService'

describe('calculateDiagnosis', () => {
  it('すべて+1の回答なら各軸が正の値になる', async () => {
    const answers = Array(20).fill(1)
    const result = await calculateDiagnosis(answers)
    expect(result.social).toBeGreaterThan(0)
    expect(result.taskStyle).toBeGreaterThan(0)
  })
  
it('ENFP 型が正しく判定される', async () => {
    const result = await calculateDiagnosis([
      // social: E, taskStyle: N, decision: F, planning: P
    ])
    expect(result.mbtiType).toBe('ENFP')
  })
})
```

### 8.2 統合テスト

```typescript
// __tests__/matchingService.test.ts
describe('getRecommendations (Hybrid)', () => {
  it('3つのスコアが統合される', async () => {
    const profile = createMockProfile()
    const recommendations = await getRecommendations(profile, 'user123')
    
    expect(recommendations).toHaveLength(20)
    expect(recommendations[0].matchScore).toBeGreaterThan(0)
    expect(recommendations[0].aiInsights).toBeDefined()
  })
})
```

### 8.3 A/B テスト設計

| グループ | アルゴリズム | 期間 | 評価指標 |
|---|---|---|---|
| A | ルールベースのみ | 2週間 | 応募転換率、満足度 |
| B | ハイブリッド (Phase 2) | 2週間 | 応募転換率、満足度 |

---

## 9. 今後の課題

### 9.1 技術的課題
- バックエンド技術選定（NestJS/Serverless 等）
- API 仕様確定（OpenAPI/tRPC）
- 協調フィルタリングのコールドスタート問題対策

### 9.2 運用課題
- 診断質問の定期的な見直し
- AI 生成結果の品質モニタリング
- プライバシー・倫理ガイドライン策定

### 9.3 機能拡張候補
- 団体向け「求める人物像」診断
- 過去参加者のフィードバック分析
- 診断結果の経年変化追跡

---

## 10. 参考文献・リンク

- [MBTI 公式サイト](https://www.myersbriggs.org/)
- [AWS Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [TensorFlow.js 公式ガイド](https://www.tensorflow.org/js)
- [XState ドキュメント](https://xstate.js.org/)

---

**更新履歴**:
- 2025-10-22: 初版作成（Phase 2 アプローチC採用を明記）