import React from 'react'
import { PersonalityProfile } from '@/lib/personality/types'
import { RefreshCw } from 'lucide-react'

interface ResultViewProps {
  result: PersonalityProfile
  onReset: () => void
}

export function ResultView({ result, onReset }: ResultViewProps) {
  const type = result.personalityType || result.closestType
  const isExactMatch = !!result.personalityType

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-white rounded-xl shadow-xl">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">診断結果</h2>
        <div className="inline-block px-4 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
          {isExactMatch ? '完全一致' : '最も近いタイプ'}
        </div>
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
          {type.name}
        </h1>
        <p className="text-xl text-gray-600 font-medium">{type.nameEn}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 mb-12">
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">特徴</h3>
            <p className="text-gray-700 leading-relaxed">
              {type.description}
            </p>
          </div>

          <div className="bg-green-50 p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-green-900 mb-3">ボランティアでの強み</h3>
            <ul className="space-y-2">
              {type.strengths.map((strength, i) => (
                <li key={i} className="flex items-center text-green-800">
                  <span className="mr-2">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-purple-50 p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-purple-900 mb-3">適した活動</h3>
            <ul className="space-y-2">
              {type.suitableActivities.map((activity, i) => (
                <li key={i} className="flex items-center text-purple-800">
                  <span className="mr-2">•</span>
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-8">
          <h3 className="text-xl font-bold text-gray-900">BIG5 スコア詳細</h3>
          <div className="space-y-6">
            <ScoreBar label="外向性 (Extraversion)" score={result.scores.extraversion} color="bg-red-500" />
            <ScoreBar label="協調性 (Agreeableness)" score={result.scores.agreeableness} color="bg-green-500" />
            <ScoreBar label="誠実性 (Conscientiousness)" score={result.scores.conscientiousness} color="bg-blue-500" />
            <ScoreBar label="神経症傾向 (Neuroticism)" score={result.scores.neuroticism} color="bg-yellow-500" />
            <ScoreBar label="開放性 (Openness)" score={result.scores.openness} color="bg-purple-500" />
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
            <p>※ スコアは0-100で表示されています。</p>
            <p>※ 神経症傾向は数値が高いほど「敏感・繊細」であることを示します。</p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onReset}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          もう一度診断する
        </button>
      </div>
    </div>
  )
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{score}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
    </div>
  )
}
