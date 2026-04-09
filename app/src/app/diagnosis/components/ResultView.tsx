import React from 'react'
import Link from 'next/link'
import { PersonalityProfile } from '@/lib/personality/types'
import { RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/Card'

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
      <Card>
        <CardContent className="py-10 text-center">
          <h2 className="text-2xl font-bold text-text-dark">診断結果</h2>
          <div className="inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            {isExactMatch ? '完全一致' : '最も近いタイプ'}
          </div>
          <h1 className="text-4xl font-extrabold text-primary">
            {type.name}
          </h1>
          <p className="text-lg font-medium text-text-body">{type.nameEn}</p>
        </CardContent>
      </Card>

      {/* 詳細セクション */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 左カラム: 特徴・強み・適した活動 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-bold text-text-dark">特徴</h3>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-text-body">
                {type.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-bold text-text-dark">ボランティアでの強み</h3>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {type.strengths.map((strength, i) => (
                  <li key={i} className="flex items-center text-text-body">
                    <span className="mr-2 text-primary">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-bold text-text-dark">適した活動</h3>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {type.suitableActivities.map((activity, i) => (
                  <li key={i} className="flex items-center text-text-body">
                    <span className="mr-2 text-primary">•</span>
                    {activity}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* 右カラム: BIG5 スコア */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold text-text-dark">BIG5 スコア詳細</h3>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
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
      <div className="h-2.5 w-full rounded-full bg-primary/20">
        <div
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
