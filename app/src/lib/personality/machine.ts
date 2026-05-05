import { createMachine, assign, fromPromise } from 'xstate'
import { DEFAULT_DIAGNOSIS_MODE, getQuestionsForMode } from './constants'
import { DiagnosisMode, QuestionAnswer, PersonalityProfile } from './types'
import { calculateBIG5Diagnosis } from './logic'

export interface DiagnosisContext {
  mode: DiagnosisMode
  currentQuestionIndex: number
  answers: QuestionAnswer[]
  result: PersonalityProfile | null
}

export type DiagnosisEvent =
  | { type: 'START'; mode?: DiagnosisMode }
  | { type: 'ANSWER'; value: number }
  | { type: 'BACK' }
  | { type: 'RESET' }

export const diagnosisMachine = createMachine({
  id: 'big5-diagnosis',
  initial: 'idle',
  context: {
    mode: DEFAULT_DIAGNOSIS_MODE,
    currentQuestionIndex: 0,
    answers: [] as QuestionAnswer[],
    result: null as PersonalityProfile | null
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'answering',
          actions: assign({
            mode: ({ event }) => event.mode ?? DEFAULT_DIAGNOSIS_MODE,
            currentQuestionIndex: 0,
            answers: [],
            result: null
          })
        }
      }
    },
    answering: {
      on: {
        ANSWER: {
          actions: assign({
            answers: ({ context, event }) => {
              const currentQuestion = getQuestionsForMode(context.mode)[context.currentQuestionIndex]
              if (!currentQuestion) return context.answers
              
              const newAnswer: QuestionAnswer = {
                questionId: currentQuestion.id,
                value: event.value,
                timestamp: new Date().toISOString()
              }
              
              // 既存の回答があれば更新、なければ追加
              const existingIndex = context.answers.findIndex(a => a.questionId === currentQuestion.id)
              if (existingIndex >= 0) {
                const newAnswers = [...context.answers]
                newAnswers[existingIndex] = newAnswer
                return newAnswers
              } else {
                return [...context.answers, newAnswer]
              }
            },
            currentQuestionIndex: ({ context }) => context.currentQuestionIndex + 1
          }),
          target: 'checkProgress'
        },
        BACK: {
          actions: assign({
            currentQuestionIndex: ({ context }) => Math.max(0, context.currentQuestionIndex - 1)
            // 回答は保持したまま戻る
          }),
          target: 'answering'
        }
      }
    },
    checkProgress: {
      always: [
        { target: 'calculating', guard: 'isComplete' },
        { target: 'answering' }
      ]
    },
    calculating: {
      invoke: {
        src: 'calculateBIG5Result',
        input: ({ context }) => ({ answers: context.answers, mode: context.mode }),
        onDone: {
          target: 'completed',
          actions: assign({ result: ({ event }) => event.output })
        },
        onError: 'error'
      }
    },
    completed: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            mode: DEFAULT_DIAGNOSIS_MODE,
            currentQuestionIndex: 0,
            answers: [],
            result: null
          })
        }
      }
    },
    error: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            mode: DEFAULT_DIAGNOSIS_MODE,
            currentQuestionIndex: 0,
            answers: [],
            result: null
          })
        }
      }
    }
  }
}, {
  guards: {
    isComplete: ({ context }) => context.currentQuestionIndex >= getQuestionsForMode(context.mode).length
  },
  actors: {
    calculateBIG5Result: fromPromise(async ({ input }: { input: { answers: QuestionAnswer[]; mode: DiagnosisMode } }) => {
      return await calculateBIG5Diagnosis(input.answers, input.mode)
    })
  }
})
