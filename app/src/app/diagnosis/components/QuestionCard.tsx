import React from 'react'
import { Question } from '@/lib/personality/types'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/app/components/ui/Card'

interface QuestionCardProps {
  question: Question
  onAnswer: (value: number) => void
  onBack: () => void
  canGoBack: boolean
  currentStep: number
  totalSteps: number
}

export function QuestionCard({
  question,
  onAnswer,
  onBack,
  canGoBack,
  currentStep,
  totalSteps
}: QuestionCardProps) {
  const progress = Math.round((currentStep / totalSteps) * 100)

  return (
    <Card className="p-6">
      {/* プログレスバー */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm text-text-body">
          <span>質問 {currentStep} / {totalSteps}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/20">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 質問テキスト */}
      <h2 className="mb-8 flex min-h-[80px] items-center justify-center text-center text-xl font-bold text-text-dark">
        {question.text}
      </h2>

      {/* 選択肢 */}
      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.value}
            onClick={() => onAnswer(option.value)}
            className="group w-full rounded-lg border-2 border-card-border p-4 text-left transition-colors duration-200 hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-text-body group-hover:text-text-dark">
                {option.label}
              </span>
              <div className="flex size-6 items-center justify-center rounded-full border-2 border-card-border group-hover:border-primary">
                <div className="size-3 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 戻るボタン */}
      <div className="mt-8 flex justify-start">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className={`flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
            ${canGoBack
              ? 'text-text-body hover:bg-primary/5'
              : 'cursor-not-allowed text-text-body/30'
            }`}
        >
          <ArrowLeft className="size-4" />
          戻る
        </button>
      </div>
    </Card>
  )
}
