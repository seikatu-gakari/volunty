'use client'

import { useMachine } from '@xstate/react'
import { diagnosisMachine } from '@/lib/personality/machine'
import { BIG5_QUESTIONS } from '@/lib/personality/constants'
import { QuestionCard } from './QuestionCard'
import { ResultView } from './ResultView'
import { Loader2, Sparkles } from 'lucide-react'

export function DiagnosisWizard() {
  const [state, send] = useMachine(diagnosisMachine)

  const currentQuestionIndex = state.context.currentQuestionIndex
  const currentQuestion = BIG5_QUESTIONS[currentQuestionIndex]

  // デバッグ用：ランダム回答機能
  const handleDebugFill = () => {
    // 現在の質問から最後までランダムに回答
    const remainingQuestions = BIG5_QUESTIONS.slice(currentQuestionIndex)
    remainingQuestions.forEach(() => {
      send({ type: 'ANSWER', value: Math.floor(Math.random() * 5) + 1 })
    })
  }

  if (state.matches('idle')) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-[10px] border border-card-border bg-white px-8 py-12 text-center shadow-sm">
        <Sparkles className="size-16 text-primary" />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-text-dark">
            ボランティア性格診断
          </h1>
          <p className="text-sm leading-6 text-text-body">
            あなたの性格特性を分析し、最適なボランティア活動を提案します。
            <br />
            全50問、所要時間は約5分です。
          </p>
        </div>
        <button
          onClick={() => send({ type: 'START' })}
          className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Sparkles className="size-5" />
          診断を開始する
        </button>
      </div>
    )
  }

  if (state.matches('answering')) {
    return (
      <div>
        <QuestionCard
          question={currentQuestion}
          onAnswer={(value) => send({ type: 'ANSWER', value })}
          onBack={() => send({ type: 'BACK' })}
          canGoBack={currentQuestionIndex > 0}
          currentStep={currentQuestionIndex + 1}
          totalSteps={BIG5_QUESTIONS.length}
        />

        {/* 開発環境のみ表示するデバッグボタン */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 text-center">
            <button
              onClick={handleDebugFill}
              className="text-xs text-text-body/50 hover:text-text-body underline"
            >
              [Debug] 残りをランダム回答して完了させる
            </button>
          </div>
        )}
      </div>
    )
  }

  if (state.matches('calculating')) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[10px] border border-card-border bg-white px-8 py-24 shadow-sm">
        <Loader2 className="size-16 animate-spin text-primary" />
        <p className="text-lg text-text-body">診断結果を計算中...</p>
      </div>
    )
  }

  if (state.matches('completed') && state.context.result) {
    return (
      <ResultView
        result={state.context.result}
        onReset={() => send({ type: 'RESET' })}
      />
    )
  }

  return null
}
