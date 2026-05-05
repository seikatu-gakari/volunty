export type BIG5Trait = 
  | 'extraversion'
  | 'agreeableness'
  | 'conscientiousness'
  | 'neuroticism'
  | 'openness'

export type DiagnosisMode = 'brief' | 'full'

export interface Question {
  id: string
  text: string
  trait: BIG5Trait
  reversed: boolean
  options: Array<{
    label: string
    value: number
  }>
}

export interface QuestionAnswer {
  questionId: string
  value: number
  timestamp: string
}

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
  priority: number
  description: string
  strengths: string[]
  suitableActivities: string[]
}

export interface PersonalityProfile {
  userId: string
  mode: DiagnosisMode
  scores: BIG5Scores
  personalityType: PersonalityType | null
  closestType: PersonalityType & { distance: number }
  timestamp: string
}
