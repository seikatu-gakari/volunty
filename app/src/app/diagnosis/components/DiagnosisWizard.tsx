'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMachine } from '@xstate/react'
import { diagnosisMachine } from '@/lib/personality/machine'
import {
  DEFAULT_DIAGNOSIS_MODE,
  DIAGNOSIS_MODE_CONFIG,
  getQuestionsForMode,
} from '@/lib/personality/constants'
import type { DiagnosisMode } from '@/lib/personality/types'
import { submitDiagnosis } from '@/lib/diagnosis/actions'
import { QuestionCard } from './QuestionCard'
import { ResultView } from './ResultView'
import { Card, CardContent } from '@/app/components/ui/Card'
import { Loader2, Sparkles } from 'lucide-react'

const DIAGNOSIS_MODES: DiagnosisMode[] = ['brief', 'full']

interface DiagnosisWizardProps {
  initialMode?: DiagnosisMode
}

export function DiagnosisWizard({ initialMode = DEFAULT_DIAGNOSIS_MODE }: DiagnosisWizardProps) {
  const router = useRouter()
  const [state, send] = useMachine(diagnosisMachine)
  const [selectedMode, setSelectedMode] = useState<DiagnosisMode>(initialMode)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const currentQuestionIndex = state.context.currentQuestionIndex
  const currentQuestions = getQuestionsForMode(state.context.mode)
  const currentQuestion = currentQuestions[currentQuestionIndex]

  // 診断完了時に自動保存（同期的な setState なし）
  useEffect(() => {
    if (!state.matches('completed') || !state.context.result) return
    if (savingRef.current) return
    savingRef.current = true

    submitDiagnosis(state.context.answers, state.context.mode)
      .then((res) => {
        if (res.success) {
          router.push('/diagnosis/result')
        } else {
          setSaveError(res.error ?? '保存に失敗しました')
          savingRef.current = false
        }
      })
      .catch(() => {
        setSaveError('予期しないエラーが発生しました')
        savingRef.current = false
      })
  }, [state, router])

  // 保存リトライ
  const handleRetry = () => {
    setSaveError(null)
    savingRef.current = true
    submitDiagnosis(state.context.answers, state.context.mode)
      .then((res) => {
        if (res.success) {
          router.push('/diagnosis/result')
        } else {
          setSaveError(res.error ?? '保存に失敗しました')
          savingRef.current = false
        }
      })
      .catch(() => {
        setSaveError('予期しないエラーが発生しました')
        savingRef.current = false
      })
  }

  // デバッグ用：ランダム回答機能
  const handleDebugFill = () => {
    const remainingQuestions = currentQuestions.slice(currentQuestionIndex)
    remainingQuestions.forEach(() => {
      send({ type: 'ANSWER', value: Math.floor(Math.random() * 5) + 1 })
    })
  }

  if (state.matches('idle')) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
          <Sparkles className="size-16 text-primary" />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-text-dark">
              ボランティア性格診断
            </h1>
            <p className="text-sm leading-6 text-text-body">
              あなたの性格特性を分析し、最適なボランティア活動を提案します。
              <br />
              目的に合わせて、短時間の簡易診断または精度重視の詳細診断を選べます。
            </p>
          </div>
          <div className="grid w-full gap-4 md:grid-cols-2">
            {DIAGNOSIS_MODES.map((mode) => {
              const config = DIAGNOSIS_MODE_CONFIG[mode]
              const isSelected = selectedMode === mode

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSelectedMode(mode)}
                  className={`rounded-2xl border p-5 text-left transition ${isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-card-border bg-white hover:border-primary/50 hover:bg-primary/5'
                    }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-text-dark">{config.label}</h2>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">
                      {config.questionCount}問
                    </span>
                  </div>
                  <p className="mb-3 text-sm leading-6 text-text-body">{config.description}</p>
                  <p className="text-xs font-medium text-text-body">
                    所要時間: {config.estimatedTime}
                  </p>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => send({ type: 'START', mode: selectedMode })}
            className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Sparkles className="size-5" />
            {DIAGNOSIS_MODE_CONFIG[selectedMode].label}を開始する
          </button>
        </CardContent>
      </Card>
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
          totalSteps={currentQuestions.length}
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

  // 計算中 or 保存中（完了後エラーなし = 保存進行中）
  if (state.matches('calculating') || (state.matches('completed') && !saveError)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="size-16 animate-spin text-primary" />
          <p className="text-lg text-text-body">
            {state.matches('calculating') ? '診断結果を計算中...' : '診断結果を保存中...'}
          </p>
        </CardContent>
      </Card>
    )
  }

  // 保存エラー時は結果表示 + エラーメッセージ
  if (state.matches('completed') && state.context.result && saveError) {
    return (
      <div>
        <Card className="mb-6">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-red-600">{saveError}</p>
            <button
              onClick={handleRetry}
              className="mt-2 text-sm font-medium text-primary underline hover:text-primary-dark"
            >
              再試行する
            </button>
          </CardContent>
        </Card>
        <ResultView
          result={state.context.result}
          onReset={() => {
            savingRef.current = false
            setSaveError(null)
            send({ type: 'RESET' })
          }}
        />
      </div>
    )
  }

  return null
}
