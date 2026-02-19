'use client'

import { useMachine } from '@xstate/react'
import { diagnosisMachine } from '@/lib/personality/machine'
import { BIG5_QUESTIONS } from '@/lib/personality/constants'
import { QuestionCard } from './QuestionCard'
import { ResultView } from './ResultView'
import { Loader2 } from 'lucide-react'

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
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          ボランティア性格診断
        </h1>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
          あなたの性格特性を分析し、最適なボランティア活動を提案します。
          全50問、所要時間は約5分です。
        </p>
        <button
          onClick={() => send({ type: 'START' })}
          className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-full hover:bg-blue-700 transition-transform hover:scale-105 shadow-lg"
        >
          診断を開始する
        </button>
      </div>
    )
  }

  if (state.matches('answering')) {
    return (
      <div className="py-10">
        <QuestionCard
          question={currentQuestion}
          onAnswer={(value) => send({ type: 'ANSWER', value })}
          onBack={() => send({ type: 'BACK' })}
          canGoBack={currentQuestionIndex > 0}
          currentStep={currentQuestionIndex + 1}
          totalSteps={BIG5_QUESTIONS.length}
          onSkip={handleDebugFill}
        />
      </div>
    )
  }

  if (state.matches('calculating')) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
        <p className="text-xl text-gray-600">診断結果を計算中...</p>
      </div>
    )
  }

  if (state.matches('completed') && state.context.result) {
    return (
      <div className="py-10">
        <ResultView
          result={state.context.result}
          onReset={() => send({ type: 'RESET' })}
        />
      </div>
    )
  }

  return null
}
