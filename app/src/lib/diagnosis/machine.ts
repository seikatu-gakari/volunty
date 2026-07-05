import { createMachine, assign } from 'xstate'
import { getItemsInDisplayOrder } from '@/lib/diagnosis-scale/scale'
import type { DiagnosisAnswer } from '@/lib/diagnosis-scale/types'

/**
 * 診断フローの XState ステートマシン。
 *
 * 採点は行わない（採点は Server Action 側で純粋関数により実行する）。
 * 回答時間（elapsedMs）と変更回数（changedCount）は回答品質判定用に収集する。
 */
export interface DiagnosisContext {
  currentQuestionIndex: number
  answers: DiagnosisAnswer[]
  /** 中断からの再開回数 */
  resumedCount: number
}

export type DiagnosisEvent =
  | { type: 'START' }
  | { type: 'ANSWER'; value: number; elapsedMs?: number }
  | { type: 'BACK' }
  | { type: 'RESET' }
  | {
      type: 'RESTORE'
      answers: DiagnosisAnswer[]
      currentQuestionIndex: number
      resumedCount: number
    }

const initialContext: DiagnosisContext = {
  currentQuestionIndex: 0,
  answers: [],
  resumedCount: 0,
}

export const diagnosisMachine = createMachine(
  {
    id: 'big5-diagnosis',
    initial: 'idle',
    context: initialContext,
    types: {} as {
      context: DiagnosisContext
      events: DiagnosisEvent
    },
    states: {
      idle: {
        on: {
          START: {
            target: 'answering',
            actions: assign(() => initialContext),
          },
          RESTORE: {
            target: 'answering',
            actions: assign({
              answers: ({ event }) => event.answers,
              currentQuestionIndex: ({ event }) =>
                Math.min(
                  Math.max(0, event.currentQuestionIndex),
                  getItemsInDisplayOrder().length - 1
                ),
              resumedCount: ({ event }) => event.resumedCount,
            }),
          },
        },
      },
      answering: {
        on: {
          ANSWER: {
            actions: assign({
              answers: ({ context, event }) => {
                const currentItem =
                  getItemsInDisplayOrder()[context.currentQuestionIndex]
                if (!currentItem) return context.answers

                const existingIndex = context.answers.findIndex(
                  (a) => a.itemCode === currentItem.itemCode
                )
                if (existingIndex >= 0) {
                  // 回答変更: 値を更新し、変更回数と経過時間を積み上げる
                  const existing = context.answers[existingIndex]
                  const updated: DiagnosisAnswer = {
                    itemCode: currentItem.itemCode,
                    value: event.value,
                    elapsedMs: (existing.elapsedMs ?? 0) + (event.elapsedMs ?? 0),
                    changedCount: (existing.changedCount ?? 0) + 1,
                  }
                  const newAnswers = [...context.answers]
                  newAnswers[existingIndex] = updated
                  return newAnswers
                }
                return [
                  ...context.answers,
                  {
                    itemCode: currentItem.itemCode,
                    value: event.value,
                    elapsedMs: event.elapsedMs ?? 0,
                    changedCount: 0,
                  },
                ]
              },
              currentQuestionIndex: ({ context }) => context.currentQuestionIndex + 1,
            }),
            target: 'checkProgress',
          },
          BACK: {
            actions: assign({
              currentQuestionIndex: ({ context }) =>
                Math.max(0, context.currentQuestionIndex - 1),
              // 回答は保持したまま戻る
            }),
            target: 'answering',
          },
        },
      },
      checkProgress: {
        always: [
          { target: 'completed', guard: 'isComplete' },
          { target: 'answering' },
        ],
      },
      completed: {
        on: {
          RESET: {
            target: 'idle',
            actions: assign(() => initialContext),
          },
        },
      },
    },
  },
  {
    guards: {
      isComplete: ({ context }) =>
        context.currentQuestionIndex >= getItemsInDisplayOrder().length,
    },
  }
)
