import { describe, it, expect } from "vitest"
import { calculateMatchScore } from "./matching"
import type { BIG5Scores } from "@/lib/personality/types"

const baseScores: BIG5Scores = {
  extraversion: 50,
  agreeableness: 50,
  conscientiousness: 50,
  neuroticism: 50,
  openness: 50,
}

describe("calculateMatchScore", () => {
  it("参加者スコアと required_traits が完全一致するとき 100 を返す", () => {
    const score = calculateMatchScore(baseScores, {
      extraversion: 50,
      agreeableness: 50,
      conscientiousness: 50,
      neuroticism: 50,
      openness: 50,
    })
    expect(score).toBe(100)
  })

  it("required_traits が空のとき デフォルト値 50 を返す", () => {
    const score = calculateMatchScore(baseScores, {})
    expect(score).toBe(50)
  })

  it("1 特性のみ指定されていて差分が最大 (100) のとき 0 を返す", () => {
    const score = calculateMatchScore(
      { ...baseScores, extraversion: 0 },
      { extraversion: 100 }
    )
    expect(score).toBe(0)
  })

  it("1 特性のみ指定されていて参加者スコアと完全一致するとき 100 を返す", () => {
    const score = calculateMatchScore(
      { ...baseScores, extraversion: 80 },
      { extraversion: 80 }
    )
    expect(score).toBe(100)
  })

  it("5 特性すべてが最大差分 (100) のとき 0 を返す", () => {
    const participantScores: BIG5Scores = {
      extraversion: 0,
      agreeableness: 0,
      conscientiousness: 0,
      neuroticism: 0,
      openness: 0,
    }
    const required: Partial<BIG5Scores> = {
      extraversion: 100,
      agreeableness: 100,
      conscientiousness: 100,
      neuroticism: 100,
      openness: 100,
    }
    const score = calculateMatchScore(participantScores, required)
    expect(score).toBe(0)
  })

  it("スコアは 0 未満にならない", () => {
    // スコアが負になるような異常値を渡しても 0 以上を保証する
    const score = calculateMatchScore(
      { ...baseScores, extraversion: 0 },
      { extraversion: 100 }
    )
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it("指定されていない特性は距離計算から除外される", () => {
    // extraversion のみ完全一致、他の特性は未指定
    const scoreA = calculateMatchScore(
      { ...baseScores, extraversion: 70 },
      { extraversion: 70 }
    )
    // 全特性が完全一致
    const scoreB = calculateMatchScore(baseScores, baseScores)
    expect(scoreA).toBe(100)
    expect(scoreB).toBe(100)
  })

  it("参加者スコアと required_traits の差分が大きいほどスコアが低くなる", () => {
    const close = calculateMatchScore(
      { ...baseScores, extraversion: 50 },
      { extraversion: 55 }
    )
    const far = calculateMatchScore(
      { ...baseScores, extraversion: 50 },
      { extraversion: 90 }
    )
    expect(close).toBeGreaterThan(far)
  })
})
