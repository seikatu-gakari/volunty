import { describe, it, expect } from 'vitest'
import { calculateBIG5Diagnosis, determinePersonalityType, findClosestPersonalityType } from './logic'
import { BIG5_QUESTIONS, PERSONALITY_TYPES } from './constants'
import { QuestionAnswer, BIG5Scores } from './types'

describe('BIG5 Logic', () => {
  describe('calculateBIG5Diagnosis', () => {
    it('should calculate scores correctly for all 5s (max score)', async () => {
      // All answers are 5
      // Reversed items (50% of items) will be 6-5=1
      // Non-reversed items (50% of items) will be 5
      // Average should be 3.0 -> Normalized score 50
      
      const answers: QuestionAnswer[] = BIG5_QUESTIONS.map(q => ({
        questionId: q.id,
        value: 5,
        timestamp: new Date().toISOString()
      }))

      const result = await calculateBIG5Diagnosis(answers)
      
      expect(result.scores.extraversion).toBe(50)
      expect(result.scores.agreeableness).toBe(50)
      expect(result.scores.conscientiousness).toBe(50)
      expect(result.scores.neuroticism).toBe(50)
      expect(result.scores.openness).toBe(50)
    })

    it('should calculate scores correctly for mixed answers', async () => {
      // Manually construct answers for Extraversion to test specific score
      // Questions: 10 items. 
      // e1(+), e2(-), e3(+), e4(-), e5(+), e6(-), e7(+), e8(-), e9(+), e10(-)
      // Let's set all non-reversed to 5, all reversed to 1 (which becomes 5)
      // Average should be 5.0 -> Score 100
      
      const answers: QuestionAnswer[] = BIG5_QUESTIONS.map(q => {
        const isExtraversion = q.trait === 'extraversion'
        let val = 3 // default neutral
        
        if (isExtraversion) {
          if (q.reversed) val = 1 // becomes 5
          else val = 5
        }
        
        return {
          questionId: q.id,
          value: val,
          timestamp: new Date().toISOString()
        }
      })

      const result = await calculateBIG5Diagnosis(answers)
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
