import { 
  BIG5Scores, 
  PersonalityType, 
  QuestionAnswer, 
  PersonalityProfile, 
  BIG5Trait 
} from './types'
import { BIG5_QUESTIONS, PERSONALITY_TYPES } from './constants'

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

/**
 * 診断結果を計算
 */
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
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function normalize(score: number): number {
  // 1-5 のスコアを 0-100 に変換
  // score 1 -> 0
  // score 5 -> 100
  return Math.round(((score - 1) / 4) * 100)
}
