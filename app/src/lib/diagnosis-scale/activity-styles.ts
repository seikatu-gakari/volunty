import { BIG5_DOMAINS, type ActivityStyleDirection, type ActivityStyleType, type DomainScores } from './types'

/** 暫定のUX基準。心理測定的・臨床的カットオフではなく、変更時は版を更新する。 */
export const ACTIVITY_STYLE_VERSION = '2.0.0'
export const ACTIVITY_STYLE_THRESHOLDS = { neutralDeviation: 15, mixedGap: 10 } as const
const CENTER: DomainScores = { extraversion: 50, agreeableness: 50, conscientiousness: 50, emotionalStability: 50, intellect: 50 }
const AXIS_CODES = ['e', 'a', 'c', 's', 'i'] as const
const LABELS = [
  ['交流', '静かな関わり'],
  ['調和', '自分の立場重視'],
  ['計画・秩序', '計画・秩序へのこだわり弱め'],
  ['穏やかな反応', '反応が出やすい'],
  ['新しい発想', '慣れた方法'],
] as const
const DESCRIPTIONS = [
  ['人との交流を好みやすい方向の回答です。', '静かな関わりを好みやすい方向の回答です。'],
  ['相手との調和を重視しやすい方向の回答です。', '自分の立場を重視しやすい方向の回答です。'],
  ['計画や秩序を重視しやすい方向の回答です。', '計画や秩序へのこだわりが比較的弱い方向の回答です。'],
  ['心配や気分の変化への反応が比較的穏やかな方向の回答です。', '心配や気分の変化などの反応が出やすい方向の回答です。'],
  ['新しい発想を好みやすい方向の回答です。', '慣れた方法を好みやすい方向の回答です。'],
] as const

/** 75/25は表示上の対称アンカー。実際のユーザースコアや人口規準ではない。 */
export const ACTIVITY_STYLE_DIRECTIONS: readonly ActivityStyleDirection[] = BIG5_DOMAINS.flatMap((domain, index) =>
  (['high', 'low'] as const).map((direction, side) => ({
    id: `${AXIS_CODES[index]}-${direction}`,
    name: LABELS[index][side], domain, direction,
    profile: { ...CENTER, [domain]: direction === 'high' ? 75 : 25 },
    description: DESCRIPTIONS[index][side],
  })),
)

function makeStyle(directions: ActivityStyleDirection[]): ActivityStyleType {
  const kind = directions.length === 0 ? 'neutral' : directions.length === 1 ? 'single' : 'mixed'
  const name = kind === 'neutral' ? '中央付近の回答（中立）' : kind === 'mixed' ? '複数の方向が近い回答（混合）' : directions[0].name
  return {
    id: directions.length === 0 ? 'v2:neutral' : `v2:${directions.map(({ id }) => id).join(',')}`,
    name, nameEn: '', classificationKind: kind, directions,
    description: kind === 'neutral'
      ? '今回の回答では、5つの特性に中心から大きく離れた方向はありません。どれか1つのスタイルに決めず、実際の5つのスコアをご覧ください。'
      : directions.map(({ description }) => description).join(''),
    tendencies: directions.map(({ name }) => name),
    activityExamples: [],
    // 互換表示用の基準点。保存・推薦・レーダーチャートには実測scaledScoresを使う。
    profile: directions.length === 1 ? { ...directions[0].profile } : { ...CENTER },
  }
}

/** 同点を含む全候補を軸順で表示する。先頭候補を勝者として選ばない。 */
export function classifyActivityStyle(scores: DomainScores): ActivityStyleType {
  if (!scores || !BIG5_DOMAINS.every((domain) => Number.isFinite(scores[domain]) && scores[domain] >= 0 && scores[domain] <= 100)) {
    throw new Error('活動スタイルには0〜100の有限な5スコアが必要です')
  }
  const maxDeviation = Math.max(...BIG5_DOMAINS.map((domain) => Math.abs(scores[domain] - 50)))
  if (maxDeviation < ACTIVITY_STYLE_THRESHOLDS.neutralDeviation) return makeStyle([])
  const directions = ACTIVITY_STYLE_DIRECTIONS.filter(({ domain, direction }) => {
    const deviation = scores[domain] - 50
    return (direction === 'high' ? deviation > 0 : deviation < 0)
      && maxDeviation - Math.abs(deviation) < ACTIVITY_STYLE_THRESHOLDS.mixedGap
  })
  return makeStyle(directions)
}

/** 保存された全方向を復元するだけで、過去のスコアを再分類しない。非正規IDは拒否する。 */
export function findActivityStyleById(id: string): ActivityStyleType | undefined {
  if (id === 'v2:neutral') return makeStyle([])
  if (!id.startsWith('v2:')) return undefined
  const ids = id.slice(3).split(',')
  const directions = ACTIVITY_STYLE_DIRECTIONS.filter((direction) => ids.includes(direction.id))
  if (directions.length === 0 || directions.length > 5 || new Set(directions.map(({ domain }) => domain)).size !== directions.length) return undefined
  const style = makeStyle(directions)
  return style.id === id ? style : undefined
}
