import React from 'react'
import Link from 'next/link'
import { PersonalityProfile } from '@/lib/personality/types'
import { RefreshCw, Search } from 'lucide-react'

interface ResultViewProps {
  result: PersonalityProfile
  onReset: () => void
}

export function ResultView({ result, onReset }: ResultViewProps) {
  const type = result.personalityType || result.closestType
  const isExactMatch = !!result.personalityType

  return (
    <div className="space-y-6">
      {/* タイトル・タイプ名 */}
      <div className="rounded-[10px] border border-card-border bg-white px-6 py-10 text-center shadow-sm">
        <h2 className="mb-4 text-2xl font-bold text-text-dark">診断結果</h2>
        <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          {isExactMatch ? '完全一致' : '最も近いタイプ'}
        </div>
        <h1 className="mb-2 text-4xl font-extrabold text-primary">
          {type.name}
        </h1>
        <p className="text-lg font-medium text-text-body">{type.nameEn}</p>
      </div>

      {/* 詳細セクション */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 左カラム: 特徴・強み・適した活動 */}
        <div className="space-y-6">
          <div className="rounded-[10px] border border-card-border bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-text-dark">特徴</h3>
            <p className="leading-relaxed text-text-body">
              {type.description}
            </p>
          </div>

          <div className="rounded-[10px] border border-card-border bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-text-dark">ボランティアでの強み</h3>
            <ul className="space-y-2">
              {type.strengths.map((strength, i) => (
                <li key={i} className="flex items-center text-text-body">
                  <span className="mr-2 text-primary">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[10px] border border-card-border bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-text-dark">適した活動</h3>
            <ul className="space-y-2">
              {type.suitableActivities.map((activity, i) => (
                <li key={i} className="flex items-center text-text-body">
                  <span className="mr-2 text-primary">•</span>
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 右カラム: BIG5 スコア */}
        <div className="rounded-[10px] border border-card-border bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-semibold text-text-dark">BIG5 スコア詳細</h3>
          <div className="space-y-5">
            <ScoreBar label="外向性" score={result.scores.extraversion} color="bg-red-500" />
            <ScoreBar label="協調性" score={result.scores.agreeableness} color="bg-green-500" />
            <ScoreBar label="誠実性" score={result.scores.conscientiousness} color="bg-blue-500" />
            <ScoreBar label="神経症傾向" score={result.scores.neuroticism} color="bg-yellow-500" />
            <ScoreBar label="開放性" score={result.scores.openness} color="bg-purple-500" />
          </div>
          <div className="mt-6 rounded-lg bg-background p-4 text-xs text-text-body">
            <p>※ スコアは0-100で表示されています。</p>
            <p>※ 神経症傾向は数値が高いほど「敏感・繊細」であることを示します。</p>
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-center">
        <Link
          href="/recommendations"
          className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Search className="size-5" />
          おすすめ案件を見る
        </Link>
        <button
          onClick={onReset}
          className="flex h-11 items-center gap-2 rounded-lg border border-card-border bg-white px-8 text-sm font-medium text-text-dark hover:bg-background"
        >
          <RefreshCw className="size-5" />
          再診断する
        </button>
      </div>
    </div>
  )
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-sm font-medium text-text-body">{label}</span>
        <span className="text-sm font-bold text-text-dark">{score}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-primary/10">
        <div
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
