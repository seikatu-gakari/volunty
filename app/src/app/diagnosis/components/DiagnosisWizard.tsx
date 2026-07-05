'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMachine } from '@xstate/react'
import { diagnosisMachine } from '@/lib/diagnosis/machine'
import { getItemsInDisplayOrder, IPIP_BFM_50_JA } from '@/lib/diagnosis-scale/scale'
import type { DiagnosisAnswer } from '@/lib/diagnosis-scale/types'
import { submitDiagnosis } from '@/lib/diagnosis/actions'
import { QuestionCard } from './QuestionCard'
import { Card, CardContent } from '@/app/components/ui/Card'
import { Loader2, Sparkles, Info } from 'lucide-react'

/** 中断・再開用の保存キー（尺度バージョンが変わったら旧データは使わない） */
const STORAGE_KEY = `volunty-diagnosis-progress-${IPIP_BFM_50_JA.scaleCode}-${IPIP_BFM_50_JA.scaleVersion}`

interface SavedProgress {
  answers: DiagnosisAnswer[]
  currentQuestionIndex: number
  resumedCount: number
  consent: boolean
  elapsedTotalMs: number
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedProgress
    if (!Array.isArray(parsed.answers) || parsed.answers.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

function saveProgress(progress: SavedProgress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // 保存できなくても診断は続行できる
  }
}

function clearProgress() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

export function DiagnosisWizard() {
  const router = useRouter()
  const [state, send] = useMachine(diagnosisMachine)
  const [consent, setConsent] = useState(false)
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savingRef = useRef(false)
  // 回答時間の計測（品質判定用の参考情報）
  const questionShownAtRef = useRef<number>(0)
  const elapsedTotalRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)

  const items = getItemsInDisplayOrder()
  const currentQuestionIndex = state.context.currentQuestionIndex
  const currentItem = items[currentQuestionIndex]

  // 中断データの読み込み（初回マウント時。ハイドレーション後に非同期で反映する）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedProgress(loadProgress())
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
    saveProgress({
      answers: state.context.answers,
      currentQuestionIndex: state.context.currentQuestionIndex,
      resumedCount: state.context.resumedCount,
      consent,
      elapsedTotalMs: elapsedTotalRef.current,
    })
  }, [state, consent])

  // 診断完了時に自動保存
  useEffect(() => {
    if (!state.matches('completed')) return
    if (savingRef.current) return
    savingRef.current = true

    submitDiagnosis({
      answers: state.context.answers,
      totalDurationMs: Math.round(elapsedTotalRef.current),
      resumedCount: state.context.resumedCount,
      consentToStoreResponses: consent,
    })
      .then((res) => {
        if (res.success) {
          clearProgress()
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
  }, [state, consent, router])

  const handleAnswer = (value: number) => {
    const now = performance.now()
    const elapsedMs = Math.round(now - questionShownAtRef.current)
    elapsedTotalRef.current += now - lastTickRef.current
    lastTickRef.current = now
    send({ type: 'ANSWER', value, elapsedMs })
  }

  const handleStart = () => {
    clearProgress()
    elapsedTotalRef.current = 0
    send({ type: 'START' })
  }

  const handleResume = () => {
    if (!savedProgress) return
    setConsent(savedProgress.consent)
    elapsedTotalRef.current = savedProgress.elapsedTotalMs
    send({
      type: 'RESTORE',
      answers: savedProgress.answers,
      currentQuestionIndex: savedProgress.currentQuestionIndex,
      resumedCount: savedProgress.resumedCount + 1,
    })
  }

  const handleRetry = () => {
    setSaveError(null)
    savingRef.current = true
    submitDiagnosis({
      answers: state.context.answers,
      totalDurationMs: Math.round(elapsedTotalRef.current),
      resumedCount: state.context.resumedCount,
      consentToStoreResponses: consent,
    })
      .then((res) => {
        if (res.success) {
          clearProgress()
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
              全50問・約5〜8分。途中で中断しても続きから再開できます。
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

          <label className="flex w-full items-start gap-2 rounded-lg border border-card-border bg-white p-4 text-left">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="text-xs leading-5 text-text-body">
              質問ごとの回答データの保存に同意します（任意）。
              回答品質の確認と診断の改善のためにのみ利用し、アカウント削除時にすべて削除されます。
              同意しない場合も診断は受けられます（集計結果のみ保存されます）。
            </span>
          </label>

          {savedProgress && (
            <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-primary/5 p-4">
              <p className="text-sm text-text-body">
                前回の続き（{savedProgress.answers.length}問回答済み）があります。
              </p>
              <button
                onClick={handleResume}
                className="flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-white hover:bg-primary-dark"
              >
                続きから再開する
              </button>
            </div>
          )}

          <button
            onClick={handleStart}
            className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Sparkles className="size-5" />
            {savedProgress ? '最初からやり直す' : '診断を開始する（全50問）'}
          </button>
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
