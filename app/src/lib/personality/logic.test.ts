import { describe, it, expect } from 'vitest'
import { calculateBIG5Diagnosis, determinePersonalityType, findClosestPersonalityType } from './logic'
import { getQuestionsForMode } from './constants'
import { BIG5Scores, DiagnosisMode, QuestionAnswer } from './types'

function createAnswers(mode: DiagnosisMode, valueForQuestion: (reversed: boolean, trait: string) => number): QuestionAnswer[] {
  return getQuestionsForMode(mode).map((question) => ({
    questionId: question.id,
    value: valueForQuestion(question.reversed, question.trait),
    timestamp: new Date().toISOString()
  }))
}

describe('BIG5 Logic', () => {
  describe('question sets', () => {
    it('should provide 16 questions for brief mode with expected trait balance', () => {
      const questions = getQuestionsForMode('brief')
      expect(questions).toHaveLength(16)
      expect(questions.filter((q) => q.trait === 'extraversion')).toHaveLength(3)
      expect(questions.filter((q) => q.trait === 'agreeableness')).toHaveLength(3)
      expect(questions.filter((q) => q.trait === 'conscientiousness')).toHaveLength(3)
      expect(questions.filter((q) => q.trait === 'neuroticism')).toHaveLength(3)
      expect(questions.filter((q) => q.trait === 'openness')).toHaveLength(4)
      expect(new Set(questions.map((q) => q.id)).size).toBe(16)
    })

    it('should provide 60 questions for full mode with 12 questions per trait', () => {
      const questions = getQuestionsForMode('full')
      expect(questions).toHaveLength(60)
      for (const trait of ['extraversion', 'agreeableness', 'conscientiousness', 'neuroticism', 'openness']) {
        expect(questions.filter((q) => q.trait === trait)).toHaveLength(12)
      }
      expect(new Set(questions.map((q) => q.id)).size).toBe(60)
    })
  })

  describe('calculateBIG5Diagnosis', () => {
    it('should calculate neutral scores correctly for brief mode', async () => {
      const answers = createAnswers('brief', () => 3)

      const result = await calculateBIG5Diagnosis(answers, 'brief')
      
      expect(result.mode).toBe('brief')
      expect(result.scores.extraversion).toBe(50)
      expect(result.scores.agreeableness).toBe(50)
      expect(result.scores.conscientiousness).toBe(50)
      expect(result.scores.neuroticism).toBe(50)
      expect(result.scores.openness).toBe(50)
    })

    it('should calculate neutral scores correctly for full mode', async () => {
      const answers = createAnswers('full', () => 3)

      const result = await calculateBIG5Diagnosis(answers, 'full')

      expect(result.mode).toBe('full')
      expect(result.scores.extraversion).toBe(50)
      expect(result.scores.agreeableness).toBe(50)
      expect(result.scores.conscientiousness).toBe(50)
      expect(result.scores.neuroticism).toBe(50)
      expect(result.scores.openness).toBe(50)
    })

    it('should calculate scores correctly for reversed answers', async () => {
      const answers = getQuestionsForMode('brief').map((question) => ({
        questionId: question.id,
        value: question.trait === 'extraversion' ? (question.reversed ? 1 : 5) : 3,
        timestamp: new Date().toISOString()
      }))

      const result = await calculateBIG5Diagnosis(answers, 'brief')
      expect(result.scores.extraversion).toBe(100)
    })
  })

  describe('determinePersonalityType', () => {
    it('should identify Innovator Leader type', () => {
      const scores: BIG5Scores = {
        extraversion: 80, // min 75
        openness: 85,     // min 80
        conscientiousness: 75, // min 70
        agreeableness: 50,
        neuroticism: 50
      }
      
      const type = determinePersonalityType(scores)
      expect(type?.id).toBe('innovator-leader')
    })

    it('should return null if no exact match', () => {
      const scores: BIG5Scores = {
        extraversion: 10,
        openness: 10,
        conscientiousness: 10,
        agreeableness: 10,
        neuroticism: 10
      }
      
      const type = determinePersonalityType(scores)
      expect(type).toBeNull()
    })
  })

  describe('findClosestPersonalityType', () => {
    it('should find closest type when no exact match', () => {
      // Innovator Leader profile but slightly off
      const scores: BIG5Scores = {
        extraversion: 70, // slightly below 75
        openness: 85,
        conscientiousness: 75,
        agreeableness: 50,
        neuroticism: 50
      }
      
      const result = findClosestPersonalityType(scores)
      expect(result.id).toBe('innovator-leader')
    })
  })
})
