import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ACTIVITY_STYLE_THRESHOLDS, classifyActivityStyle } from './activity-styles'
import { IPIP_BFM_50_JA, IPIP_BFM_50_JA_BRIEF15 } from './scale'
import { scoreDiagnosis } from './scoring'
import { BIG5_DOMAINS, type DiagnosisAnswer, type DomainScores, type ScaleDefinition } from './types'

const SCALES = [IPIP_BFM_50_JA, IPIP_BFM_50_JA_BRIEF15]
const SCENARIOS = ['center', 'uniform', 'skewed'] as const
const SAMPLE_COUNT = 256
const SEED = 3082026
const CODES = ['e', 'a', 'c', 's', 'i']

function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** 合計を均等に各項目へ配分して逆転キーを戻す。実在の回答者を模したものではない。 */
function answersFromRaw(scale: ScaleDefinition, raw: number[]): DiagnosisAnswer[] {
  const n = scale.items.length / 5
  const positions = BIG5_DOMAINS.map(() => 0)
  return scale.items.map((item) => {
    const axis = BIG5_DOMAINS.indexOf(item.domain)
    const base = Math.floor(raw[axis] / n)
    const keyed = base + (positions[axis]++ < raw[axis] % n ? 1 : 0)
    return { itemCode: item.itemCode, value: item.keyed === '-' ? 6 - keyed : keyed }
  })
}

function scoresFromAnswers(scale: ScaleDefinition, answers: DiagnosisAnswer[]): DomainScores {
  const result = scoreDiagnosis(answers, scale)
  if (!result.success) throw new Error(result.message)
  return result.score.scaledScores
}

/** 比較用モデル。製品側の閾値を変更せず9通りの設定を比較する。 */
function signature(scores: DomainScores, neutral: number, gap: number): string {
  const deviations = BIG5_DOMAINS.map((domain) => scores[domain] - 50)
  const max = Math.max(...deviations.map(Math.abs))
  if (max < neutral) return 'v2:neutral'
  return `v2:${deviations.flatMap((d, i) => d !== 0 && max - Math.abs(d) < gap ? [`${CODES[i]}-${d > 0 ? 'high' : 'low'}`] : []).join(',')}`
}

function cardinality(id: string) {
  return id === 'v2:neutral' ? 0 : id.split(',').length
}

function sampleAnswers(scale: ScaleDefinition, scenario: typeof SCENARIOS[number]) {
  const next = random(SEED + scale.items.length + SCENARIOS.indexOf(scenario))
  const n = scale.items.length / 5
  return Array.from({ length: SAMPLE_COUNT }, () => answersFromRaw(scale, BIG5_DOMAINS.map((_, axis) => {
    if (scenario === 'uniform') return n + Math.floor(next() * (4 * n + 1))
    if (scenario === 'skewed') {
      const p = [0.8, 0.65, 0.45, 0.3, 0.2][axis]
      return n + Array.from({ length: 4 * n }, () => Number(next() < p)).reduce((a, b) => a + b, 0)
    }
    return Array.from({ length: n }, () => {
      const u = next()
      return u < 0.05 ? 1 : u < 0.25 ? 2 : u < 0.75 ? 3 : u < 0.95 ? 4 : 5
    }).reduce((a, b) => a + b, 0)
  })))
}

function perturbations(scale: ScaleDefinition, answers: DiagnosisAnswer[]) {
  return answers.flatMap((answer, index) => [-1, 1].flatMap((delta) => {
    if (answer.value + delta < 1 || answer.value + delta > 5) return []
    return [scoresFromAnswers(scale, answers.map((entry, i) => i === index ? { ...entry, value: entry.value + delta } : entry))]
  }))
}

function asScores(values: number[]): DomainScores {
  return Object.fromEntries(BIG5_DOMAINS.map((domain, i) => [domain, values[i]])) as DomainScores
}

describe('活動スタイルの合成データ感度（人口規準ではない）', () => {
  it.each(SCALES)('$scaleCode の全到達可能スコアと1回答の刻みを実採点から確認する', (scale) => {
    const n = scale.items.length / 5
    const lattice = Array.from({ length: 4 * n + 1 }, (_, i) => scoresFromAnswers(scale, answersFromRaw(scale, Array(5).fill(n + i))).extraversion)
    const increments = [...new Set(lattice.slice(1).map((value, i) => Math.round((value - lattice[i]) * 10) / 10))].sort()
    expect(increments).toEqual(n === 10 ? [2.5] : [8.3, 8.4])
    expect(lattice).toHaveLength(n === 10 ? 41 : 13)
    expect(lattice[0]).toBe(0)
    expect(lattice.at(-1)).toBe(100)
    // 到達可能な中心直前・直後の境界。15問では15点そのものには到達しない。
    const below = n === 10 ? 35 : 10
    expect(classifyActivityStyle(scoresFromAnswers(scale, answersFromRaw(scale, [below, 3 * n, 3 * n, 3 * n, 3 * n]))).classificationKind).toBe('neutral')
    expect(classifyActivityStyle(scoresFromAnswers(scale, answersFromRaw(scale, [below + 1, 3 * n, 3 * n, 3 * n, 3 * n]))).classificationKind).toBe('single')
  })

  it('両尺度で中立・単独・2〜5方向混合を実回答から到達できる', () => {
    for (const scale of SCALES) {
      const n = scale.items.length / 5
      for (let count = 0; count <= 5; count++) {
        const raw = BIG5_DOMAINS.map((_, axis) => axis < count ? (axis % 2 ? 2 : 4) * n : 3 * n)
        expect(classifyActivityStyle(scoresFromAnswers(scale, answersFromRaw(scale, raw))).directions).toHaveLength(count)
      }
    }
  })

  it('固定seedの3分布と全1回答±1変化を比較し、軸・符号対称性を保持する', () => {
    expect(ACTIVITY_STYLE_THRESHOLDS).toEqual({ neutralDeviation: 15, mixedGap: 10 })
    const rows: { mode: number; scenario: string; neutral: number; gap: number; counts: number[]; edges: number; flips: number; kindFlips: number }[] = []
    const symmetry: { mode: number; scenario: string; eachDirection: number; observedDirections: number[] }[] = []
    for (const scale of SCALES) for (const scenario of SCENARIOS) {
      const samples = sampleAnswers(scale, scenario).map((answers) => ({ scores: scoresFromAnswers(scale, answers), neighbors: perturbations(scale, answers) }))
      const directionCounts = Array(10).fill(0) as number[]
      const observedDirections = Array(10).fill(0) as number[]
      let modelMismatches = 0
      let invalidChanges = 0
      for (const { scores, neighbors } of samples) {
        // 製品関数と独立の比較モデルを全基準回答・全近傍で照合する。
        for (const candidate of [scores, ...neighbors]) {
          modelMismatches += Number(classifyActivityStyle(candidate).id !== signature(candidate, 15, 10))
          if (candidate !== scores) {
            const changes = BIG5_DOMAINS.map((domain) => Math.round(Math.abs(candidate[domain] - scores[domain]) * 10) / 10).filter(Boolean)
            invalidChanges += Number(changes.length !== 1 || !(scale.items.length === 50 ? [2.5] : [8.3, 8.4]).includes(changes[0]))
          }
        }
        const values = BIG5_DOMAINS.map((domain) => scores[domain])
        const original = classifyActivityStyle(scores)
        for (const direction of original.directions ?? []) observedDirections[BIG5_DOMAINS.indexOf(direction.domain) * 2 + Number(direction.direction === 'low')]++
        for (let shift = 0; shift < 5; shift++) for (const reflected of [false, true]) {
          const transformed = asScores(values.map((_, axis) => {
            const value = values[(axis + shift) % 5]
            return reflected ? Math.round((100 - value) * 10) / 10 : value
          }))
          const style = classifyActivityStyle(transformed)
          const expectedIds = (original.directions ?? []).map(({ domain, direction }) => {
            const axis = (BIG5_DOMAINS.indexOf(domain) - shift + 5) % 5
            return `${CODES[axis]}-${reflected ? direction === 'high' ? 'low' : 'high' : direction}`
          }).sort()
          expect((style.directions ?? []).map(({ id }) => id).sort()).toEqual(expectedIds)
          for (const direction of style.directions ?? []) directionCounts[BIG5_DOMAINS.indexOf(direction.domain) * 2 + Number(direction.direction === 'low')]++
        }
      }
      expect(modelMismatches).toBe(0)
      expect(invalidChanges).toBe(0)
      expect(new Set(directionCounts).size).toBe(1)
      symmetry.push({ mode: scale.items.length, scenario, eachDirection: directionCounts[0], observedDirections })
      for (const neutral of [10, 15, 20]) for (const gap of [5, 10, 15]) {
        const row = { mode: scale.items.length, scenario, neutral, gap, counts: Array(6).fill(0) as number[], edges: 0, flips: 0, kindFlips: 0 }
        for (const { scores, neighbors } of samples) {
          const before = signature(scores, neutral, gap)
          const size = cardinality(before)
          row.counts[size]++
          for (const neighbor of neighbors) {
            const after = signature(neighbor, neutral, gap)
            row.edges++
            row.flips += Number(before !== after)
            row.kindFlips += Number(Math.min(size, 2) !== Math.min(cardinality(after), 2))
          }
        }
        expect(row.counts.reduce((a, b) => a + b, 0)).toBe(SAMPLE_COUNT)
        rows.push(row)
      }
    }
    for (const scale of SCALES) for (const scenario of SCENARIOS) {
      const group = rows.filter((row) => row.mode === scale.items.length && row.scenario === scenario)
      for (const gap of [5, 10, 15]) {
        const neutralCounts = group.filter((row) => row.gap === gap).map((row) => row.counts[0])
        expect(neutralCounts).toEqual([...neutralCounts].sort((a, b) => a - b))
      }
      for (const neutral of [10, 15, 20]) {
        const matches = group.filter((row) => row.neutral === neutral)
        expect(new Set(matches.map((row) => row.counts[0])).size).toBe(1)
        const singles = matches.map((row) => row.counts[1])
        expect(singles).toEqual([...singles].sort((a, b) => b - a))
      }
    }
    // 数値表全体の回帰検出。更新時は根拠と文書表も同時にレビューする。
    expect(createHash('sha256').update(JSON.stringify({ rows, symmetry })).digest('hex')).toMatchInlineSnapshot(`"720a64aec199b5802fccb19297564bd8f510c33ffb8c793c59a844f85472d8e8"`)
    if (process.env.ACTIVITY_STYLE_SENSITIVITY_REPORT === '1') {
      console.log('SENSITIVITY_REPORT_BEGIN')
      console.log('| 問数 | 分布 | 中立閾値/混合差 | 中立 | 単独 | 混合2 | 混合3 | 混合4 | 混合5 | 有効変化数 | ID変化数 (%) | 種別変化数 (%) |')
      console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
      for (const row of rows) console.log(`| ${row.mode} | ${row.scenario} | ${row.neutral}/${row.gap} | ${row.counts.join(' | ')} | ${row.edges} | ${row.flips} (${(100 * row.flips / row.edges).toFixed(2)}) | ${row.kindFlips} (${(100 * row.kindFlips / row.edges).toFixed(2)}) |`)
      console.log('\n| 問数 | 分布 | 対称拡張後の各方向出現数（10方向共通） |\n| --- | --- | --- |')
      for (const row of symmetry) console.log(`| ${row.mode} | ${row.scenario} | ${row.eachDirection} |`)
      console.log('\n| 問数 | 分布 | e高 | e低 | a高 | a低 | c高 | c低 | s高 | s低 | i高 | i低 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
      for (const row of symmetry) console.log(`| ${row.mode} | ${row.scenario} | ${row.observedDirections.join(' | ')} |`)
      console.log('SENSITIVITY_REPORT_END')
    }
  }, 30000)
})
