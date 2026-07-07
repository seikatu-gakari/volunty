import type { ActivityStyleType, DomainScores } from './types'
import { BIG5_DOMAINS } from './types'

/**
 * 活動スタイルの参考タイプ定義。
 *
 * これは心理測定の本体ではなく、診断結果を理解しやすくするための
 * 補助的なナラティブである。判定は「代表プロファイルとの近さによる参考分類」
 * であり、心理学的に検証された類型ではない。
 * 旧10類型の閾値判定（完全一致・priority）は廃止し、代表プロファイルは
 * 旧 criteria の中央値から機械的に導出した（神経症傾向は情緒安定性へ反転）。
 */
export const STYLE_TYPE_VERSION = '1.0.0'

export const ACTIVITY_STYLE_TYPES: ActivityStyleType[] = [
  {
    id: 'innovator-leader',
    name: 'イノベーター・リーダータイプ',
    nameEn: 'Innovator Leader',
    description: '新しいアイデアを積極的に出しながら、チームを引っ張る役割を楽しめる傾向があります',
    tendencies: ['企画立案', 'チームの牽引', '新しい取り組みへの挑戦'],
    activityExamples: ['イベント統括', '社会課題への新しいアプローチづくり'],
    profile: { extraversion: 85, agreeableness: 50, conscientiousness: 80, emotionalStability: 50, intellect: 90 },
  },
  {
    id: 'supporter-care',
    name: 'サポーター・ケアタイプ',
    nameEn: 'Supporter Care',
    description: '他の人の気持ちに寄り添い、安定して支え続けることにやりがいを感じやすい傾向があります',
    tendencies: ['傾聴', '継続的なサポート', '相手に合わせた関わり方'],
    activityExamples: ['高齢者支援', '傾聴ボランティア', '継続的な見守り活動'],
    profile: { extraversion: 70, agreeableness: 90, conscientiousness: 50, emotionalStability: 70, intellect: 50 },
  },
  {
    id: 'creative-solo',
    name: 'クリエイティブ・ソロタイプ',
    nameEn: 'Creative Solo',
    description: '独創的なアイデアを一人でじっくり深めることを好みやすい傾向があります',
    tendencies: ['デザイン制作', 'ライティング', '集中して取り組む作業'],
    activityExamples: ['広報物作成', 'アート制作', '静かな環境での作業'],
    profile: { extraversion: 10, agreeableness: 50, conscientiousness: 70, emotionalStability: 50, intellect: 100 },
  },
  {
    id: 'perfectionist-analyst',
    name: 'パーフェクショニスト・アナリストタイプ',
    nameEn: 'Perfectionist Analyst',
    description: '細部まで丁寧に確認しながら、高い品質基準で作業を進めやすい傾向があります',
    tendencies: ['データ入力', '会計管理', '記録作成'],
    activityExamples: ['精密な作業', '品質チェック', 'ドキュメント整備'],
    profile: { extraversion: 50, agreeableness: 50, conscientiousness: 100, emotionalStability: 20, intellect: 60 },
  },
  {
    id: 'charisma-entertainer',
    name: 'カリスマ・エンターテイナータイプ',
    nameEn: 'Charisma Entertainer',
    description: '人を惹きつけ、楽しい雰囲気をつくることが得意になりやすい傾向があります',
    tendencies: ['場を盛り上げる進行', '来場者への声かけ', '発信活動'],
    activityExamples: ['子どもイベント', 'ステージ進行', 'SNS発信'],
    profile: { extraversion: 100, agreeableness: 90, conscientiousness: 50, emotionalStability: 50, intellect: 95 },
  },
  {
    id: 'strategist-planner',
    name: 'ストラテジスト・プランナータイプ',
    nameEn: 'Strategist Planner',
    description: '長期的な視点で計画を立て、着実に実行することを好みやすい傾向があります',
    tendencies: ['プロジェクトマネジメント', '予算管理', '進捗管理'],
    activityExamples: ['企画全体の設計', 'リスク管理', '成果測定'],
    profile: { extraversion: 50, agreeableness: 50, conscientiousness: 100, emotionalStability: 70, intellect: 85 },
  },
  {
    id: 'harmony-mediator',
    name: 'ハーモニー・メディエータータイプ',
    nameEn: 'Harmony Mediator',
    description: '立場の違う人たちの間に立ち、チームの調和を大切にしやすい傾向があります',
    tendencies: ['チーム調整', '意見のとりまとめ', '橋渡し役'],
    activityExamples: ['ファシリテーション', '多様な参加者の橋渡し'],
    profile: { extraversion: 70, agreeableness: 100, conscientiousness: 50, emotionalStability: 75, intellect: 50 },
  },
  {
    id: 'adventure-explorer',
    name: 'アドベンチャー・エクスプローラータイプ',
    nameEn: 'Adventure Explorer',
    description: '新しい経験や未知の環境に、積極的に飛び込むことを楽しめる傾向があります',
    tendencies: ['屋外活動', '変化の多い環境への対応', '体を動かす活動'],
    activityExamples: ['屋外活動', '被災地支援', '海外ボランティア'],
    profile: { extraversion: 95, agreeableness: 50, conscientiousness: 50, emotionalStability: 85, intellect: 100 },
  },
  {
    id: 'conservative-guardian',
    name: 'コンサバティブ・ガーディアンタイプ',
    nameEn: 'Conservative Guardian',
    description: '決まった手順やルールを大切にし、安定した活動を続けやすい傾向があります',
    tendencies: ['定例活動の継続', 'ルールの遵守', '安全管理'],
    activityExamples: ['継続的な地域清掃', '伝統行事の運営補助'],
    profile: { extraversion: 50, agreeableness: 85, conscientiousness: 95, emotionalStability: 50, intellect: 20 },
  },
  {
    id: 'sensitive-artist',
    name: 'センシティブ・アーティストタイプ',
    nameEn: 'Sensitive Artist',
    description: '感受性が豊かで、繊細な表現や創作を通じた関わりを好みやすい傾向があります',
    tendencies: ['音楽・アートでの表現', '少人数での丁寧な関わり'],
    activityExamples: ['音楽演奏', '朗読', '少人数の穏やかな環境での創作活動'],
    profile: { extraversion: 25, agreeableness: 50, conscientiousness: 50, emotionalStability: 15, intellect: 100 },
  },
]

export interface ClosestStyleType {
  type: ActivityStyleType
  /** 代表プロファイルとのユークリッド距離（参考値） */
  distance: number
}

/**
 * scaled score (0-100) に最も近い参考タイプを返す。
 * 必ず1タイプを返し、等距離の場合は定義順で先のタイプを返す（決定的）。
 */
export function findClosestStyleType(scores: DomainScores): ClosestStyleType {
  let closest: ClosestStyleType | null = null
  for (const type of ACTIVITY_STYLE_TYPES) {
    let sumOfSquares = 0
    for (const domain of BIG5_DOMAINS) {
      const diff = scores[domain] - type.profile[domain]
      sumOfSquares += diff * diff
    }
    const distance = Math.sqrt(sumOfSquares)
    if (!closest || distance < closest.distance) {
      closest = { type, distance }
    }
  }
  if (!closest) {
    throw new Error('参考タイプが定義されていません')
  }
  return closest
}

/** タイプIDから参考タイプを引く（存在しない場合 undefined） */
export function findStyleTypeById(id: string): ActivityStyleType | undefined {
  return ACTIVITY_STYLE_TYPES.find((type) => type.id === id)
}
