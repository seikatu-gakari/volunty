import React from 'react'
import { Question } from '@/lib/personality/types'

interface QuestionCardProps {
  question: Question
  onAnswer: (value: number) => void
  onBack: () => void
  canGoBack: boolean
  currentStep: number
  totalSteps: number
  onSkip?: () => void
}

export function QuestionCard({
  question,
  onAnswer,
  onBack,
  canGoBack,
  currentStep,
  totalSteps,
  onSkip
}: QuestionCardProps) {
  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Question {currentStep} / {totalSteps}</span>
          <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          ></div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center min-h-[80px] flex items-center justify-center">
        {question.text}
      </h2>

      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.value}
            onClick={() => onAnswer(option.value)}
            className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors duration-200 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium text-gray-700 group-hover:text-blue-700">
                {option.label}
              </span>
              <div className="w-6 h-6 rounded-full border-2 border-gray-300 group-hover:border-blue-500 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
            ${canGoBack
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
            }`}
        >
          ← Back
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 underline px-2 py-1"
          >
            [Debug] 残りをランダム回答
          </button>
        )}
      </div>
    </div>
  )
}
