'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMachine } from '@xstate/react'
import { diagnosisMachine } from '@/lib/diagnosis/machine'
import { getItemsInDisplayOrder, getScaleDefinition } from '@/lib/diagnosis-scale/scale'
import type { DiagnosisAnswer, DiagnosisMode } from '@/lib/diagnosis-scale/types'
import { submitDiagnosis } from '@/lib/diagnosis/actions'
import { QuestionCard } from './QuestionCard'
import { Card, CardContent } from '@/app/components/ui/Card'
import { Loader2, Sparkles, Info, Zap } from 'lucide-react'

interface SavedProgress {
  mode: DiagnosisMode
  answers: DiagnosisAnswer[]
  currentQuestionIndex: number
  resumedCount: number
  elapsedTotalMs: number
}

/** 中断・再開用の保存キー（モード・尺度バージョンが変わったら旧データは使わない） */
function storageKeyFor(mode: DiagnosisMode): string {
  const scale = getScaleDefinition(mode)
  return `volunty-diagnosis-progress-${scale.scaleCode}-${scale.scaleVersion}`
}

function loadProgress(mode: DiagnosisMode): SavedProgress | null {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(mode))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedProgress
    if (!Array.isArray(parsed.answers) || parsed.answers.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

function saveProgress(mode: DiagnosisMode, progress: SavedProgress) {
  try {
    window.localStorage.setItem(storageKeyFor(mode), JSON.stringify(progress))
  } catch {
    // 保存できなくても診断は続行できる
  }
}

function clearProgress(mode: DiagnosisMode) {
  try {
    window.localStorage.removeItem(storageKeyFor(mode))
  } catch {
    // noop
  }
}

export function DiagnosisWizard() {
  const router = useRouter()
  const [state, send] = useMachine(diagnosisMachine)
  const [savedProgressByMode, setSavedProgressByMode] = useState<
    Partial<Record<DiagnosisMode, SavedProgress>>
  >({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const savingRef = useRef(false)
  // 回答時間の計測（品質判定用の参考情報）
  const questionShownAtRef = useRef<number>(0)
  const elapsedTotalRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)

  const mode = state.context.mode
  const items = getItemsInDisplayOrder(getScaleDefinition(mode))
  const currentQuestionIndex = state.context.currentQuestionIndex
  const currentItem = items[currentQuestionIndex]

  // 中断データの読み込み（初回マウント時。ハイドレーション後に非同期で反映する）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedProgressByMode({
        full: loadProgress('full') ?? undefined,
        brief: loadProgress('brief') ?? undefined,
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  // 質問が変わるたびに表示時刻を記録
  useEffect(() => {
    questionShownAtRef.current = performance.now()
    lastTickRef.current = performance.now()
  }, [currentQuestionIndex])

  // 回答のたびに進捗を保存（中断・再開用）
  useEffect(() => {
    if (!state.matches('answering') || state.context.answers.length === 0) return
    saveProgress(mode, {
      mode,
      answers: state.context.answers,
      currentQuestionIndex: state.context.currentQuestionIndex,
      resumedCount: state.context.resumedCount,
      elapsedTotalMs: elapsedTotalRef.current,
    })
  }, [state, mode])

  // 診断完了時に自動保存
  useEffect(() => {
    if (!state.matches('completed')) return
    if (savingRef.current) return
    savingRef.current = true

    submitDiagnosis({
      answers: state.context.answers,
      mode,
      totalDurationMs: Math.round(elapsedTotalRef.current),
      resumedCount: state.context.resumedCount,
    })
      .then((res) => {
        if (res.success) {
          clearProgress(mode)
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
  }, [state, mode, router])

  const handleAnswer = (value: number) => {
    const now = performance.now()
    const elapsedMs = Math.round(now - questionShownAtRef.current)
    elapsedTotalRef.current += now - lastTickRef.current
    lastTickRef.current = now
    send({ type: 'ANSWER', value, elapsedMs })
  }

  const handleStart = (startMode: DiagnosisMode) => {
    clearProgress(startMode)
    elapsedTotalRef.current = 0
    send({ type: 'START', mode: startMode })
  }

  const handleResume = (resumeMode: DiagnosisMode) => {
    const saved = savedProgressByMode[resumeMode]
    if (!saved) return
    elapsedTotalRef.current = saved.elapsedTotalMs
    send({
      type: 'RESTORE',
      mode: resumeMode,
      answers: saved.answers,
      currentQuestionIndex: saved.currentQuestionIndex,
      resumedCount: saved.resumedCount + 1,
    })
  }

  const handleRetry = () => {
    setSaveError(null)
    savingRef.current = true
    submitDiagnosis({
      answers: state.context.answers,
      mode,
      totalDurationMs: Math.round(elapsedTotalRef.current),
      resumedCount: state.context.resumedCount,
    })
      .then((res) => {
        if (res.success) {
          clearProgress(mode)
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
    const remaining = items.length - currentQuestionIndex
    for (let i = 0; i < remaining; i++) {
      send({
        type: 'ANSWER',
        value: Math.floor(Math.random() * 5) + 1,
        elapsedMs: 1200,
      })
    }
  }

  if (state.matches('idle')) {
    const briefSaved = savedProgressByMode.brief
    const fullSaved = savedProgressByMode.full

    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
          <Sparkles className="size-16 text-primary" />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-text-dark">性格傾向チェック（BIG5）</h1>
            <p className="text-sm leading-6 text-text-body">
              国際的に公開されている性格研究用の質問項目（IPIP）をもとに、
              5つの性格特性の傾向を確認します。
              <br />
              途中で中断しても続きから再開できます。
            </p>
          </div>

          <div className="w-full rounded-2xl border border-card-border bg-white p-5 text-left">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-text-dark">
              <Info className="size-4 text-primary" />
              はじめる前に
            </div>
            <ul className="space-y-1.5 text-xs leading-5 text-text-body">
              <li>・この診断は自己報告に基づく性格の傾向を確認するもので、医療・心理臨床の診断ではありません。</li>
              <li>・能力や適性の優劣を測るものではなく、性格に良し悪しはありません。</li>
              <li>・正解はありません。深く考えすぎず、普段の自分に近いものを選んでください。</li>
              <li>・結果はおすすめ案件の並び順の参考の一つに使われます。性格を理由に応募できなくなることはありません。</li>
              <li>・回答はその時の状態で変わることがあります。いつでも再診断できます。</li>
            </ul>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            {/* 簡易診断（15問） */}
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-white p-5">
              <Zap className="size-8 text-primary" />
              <div>
                <p className="text-base font-bold text-text-dark">簡易診断</p>
                <p className="text-xs text-text-body">15問・約2分</p>
              </div>
              <p className="text-xs leading-5 text-text-body">
                スキマ時間でざっくり傾向を知りたい方向け。
                項目数が少ないため、全50問版より結果の安定性は下がります。
              </p>
              {briefSaved && (
                <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-primary/5 p-3">
                  <p className="text-xs text-text-body">
                    前回の続き（{briefSaved.answers.length}問回答済み）
                  </p>
                  <button
                    onClick={() => handleResume('brief')}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    続きから再開する
                  </button>
                </div>
              )}
              <button
                onClick={() => handleStart('brief')}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-primary px-4 text-sm font-medium text-primary hover:bg-primary/5"
              >
                {briefSaved ? '最初からやり直す' : '簡易診断を始める（15問）'}
              </button>
            </div>

            {/* 全50問診断 */}
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-white p-5">
              <Sparkles className="size-8 text-primary" />
              <div>
                <p className="text-base font-bold text-text-dark">全50問でしっかり診断</p>
                <p className="text-xs text-text-body">約5〜8分</p>
              </div>
              <p className="text-xs leading-5 text-text-body">
                より安定した結果を得たい方におすすめ。
                おすすめ案件の並び順にはこちらの結果がより参考になります。
              </p>
              {fullSaved && (
                <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-primary/5 p-3">
                  <p className="text-xs text-text-body">
                    前回の続き（{fullSaved.answers.length}問回答済み）
                  </p>
                  <button
                    onClick={() => handleResume('full')}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    続きから再開する
                  </button>
                </div>
              )}
              <button
                onClick={() => handleStart('full')}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
              >
                {fullSaved ? '最初からやり直す' : '全50問で診断を始める'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (state.matches('answering') && currentItem) {
    return (
      <div>
        <QuestionCard
          item={currentItem}
          onAnswer={handleAnswer}
          onBack={() => send({ type: 'BACK' })}
          canGoBack={currentQuestionIndex > 0}
          currentStep={currentQuestionIndex + 1}
          totalSteps={items.length}
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

  // 保存中
  if (state.matches('completed') && !saveError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="size-16 animate-spin text-primary" />
          <p className="text-lg text-text-body">診断結果を保存中...</p>
        </CardContent>
      </Card>
    )
  }

  // 保存エラー時はリトライを提示
  if (state.matches('completed') && saveError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-red-600">{saveError}</p>
          <button
            onClick={handleRetry}
            className="flex h-10 items-center rounded-lg bg-primary px-6 text-sm font-medium text-white hover:bg-primary-dark"
          >
            再試行する
          </button>
          <button
            onClick={() => {
              savingRef.current = false
              setSaveError(null)
              send({ type: 'RESET' })
            }}
            className="text-xs text-text-body underline hover:text-text-dark"
          >
            最初からやり直す
          </button>
        </CardContent>
      </Card>
    )
  }

  return null
}
