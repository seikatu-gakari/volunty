import { describe, it, expect } from 'vitest'
import {
  IPIP_BFM_50_JA,
  IPIP_BFM_50_JA_BRIEF15,
  SCORING_ALGORITHM_VERSION,
  NORMS_VERSION,
  getScaleDefinition,
  getItemsInDisplayOrder,
} from './scale'
import type { Big5Domain } from './types'

// 一次資料（確認日 2026-07-04）:
// - 項目: https://ipip.ori.org/JapaneseBig-FiveFactorMarkers.htm
// - 採点キー: https://ipip.ori.org/newBigFive5broadKey.htm
describe('IPIP_BFM_50_JA 尺度定義', () => {
  it('50項目で構成される', () => {
    expect(IPIP_BFM_50_JA.items).toHaveLength(50)
  })

  it('各ドメイン10項目ずつ含む', () => {
    const domains: Big5Domain[] = [
      'extraversion',
      'agreeableness',
      'conscientiousness',
      'emotionalStability',
      'intellect',
    ]
    for (const domain of domains) {
      expect(
        IPIP_BFM_50_JA.items.filter((item) => item.domain === domain)
      ).toHaveLength(10)
    }
  })

  it('採点キーの+/-配分が公式キーと一致する', () => {
    // 公式10項目版キー: E=5+/5-, A=6+/4-, C=6+/4-, ES=2+/8-, I=7+/3-
    const expected: Record<Big5Domain, { plus: number; minus: number }> = {
      extraversion: { plus: 5, minus: 5 },
      agreeableness: { plus: 6, minus: 4 },
      conscientiousness: { plus: 6, minus: 4 },
      emotionalStability: { plus: 2, minus: 8 },
      intellect: { plus: 7, minus: 3 },
    }
    for (const [domain, counts] of Object.entries(expected)) {
      const items = IPIP_BFM_50_JA.items.filter((i) => i.domain === domain)
      expect(items.filter((i) => i.keyed === '+')).toHaveLength(counts.plus)
      expect(items.filter((i) => i.keyed === '-')).toHaveLength(counts.minus)
    }
  })

  it('itemCode が一意である', () => {
    const codes = IPIP_BFM_50_JA.items.map((i) => i.itemCode)
    expect(new Set(codes).size).toBe(50)
  })

  it('displayOrder が 1〜50 で一意である', () => {
    const orders = IPIP_BFM_50_JA.items.map((i) => i.displayOrder).sort((a, b) => a - b)
    expect(orders).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
  })

  it('全項目に日本語文・英語原文が設定されている', () => {
    for (const item of IPIP_BFM_50_JA.items) {
      expect(item.textJa.length).toBeGreaterThan(0)
      expect(item.textEnOriginal.length).toBeGreaterThan(0)
    }
  })

  it('代表項目が一次資料の文言と一致する', () => {
    const byOrder = new Map(IPIP_BFM_50_JA.items.map((i) => [i.displayOrder, i]))
    expect(byOrder.get(1)).toMatchObject({
      textJa: '盛り上げ役である',
      textEnOriginal: 'Am the life of the party.',
      domain: 'extraversion',
      keyed: '+',
    })
    expect(byOrder.get(2)).toMatchObject({
      textJa: '他人を気づかうことはない',
      textEnOriginal: 'Feel little concern for others.',
      domain: 'agreeableness',
      keyed: '-',
    })
    expect(byOrder.get(49)).toMatchObject({
      textJa: '落ち込むことが多い',
      textEnOriginal: 'Often feel blue.',
      domain: 'emotionalStability',
      keyed: '-',
    })
    expect(byOrder.get(50)).toMatchObject({
      textJa: 'アイディアが豊富である',
      textEnOriginal: 'Am full of ideas.',
      domain: 'intellect',
      keyed: '+',
    })
  })

  it('出典・ライセンス・バージョンのメタデータを持つ', () => {
    expect(IPIP_BFM_50_JA.scaleCode).toBe('ipip-bfm-50-ja')
    expect(IPIP_BFM_50_JA.scaleVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(IPIP_BFM_50_JA.sourceUrl).toContain('ipip.ori.org')
    expect(IPIP_BFM_50_JA.scoringKeyUrl).toContain('ipip.ori.org')
    expect(IPIP_BFM_50_JA.license).toContain('public domain')
    expect(IPIP_BFM_50_JA.licenseVerifiedAt).toBe('2026-07-04')
    expect(SCORING_ALGORITHM_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    // 日本人向け標準化データは存在しないため null
    expect(NORMS_VERSION).toBeNull()
  })
})

describe('IPIP_BFM_50_JA_BRIEF15 簡易版尺度定義', () => {
  it('15項目で構成される', () => {
    expect(IPIP_BFM_50_JA_BRIEF15.items).toHaveLength(15)
  })

  it('各ドメイン3項目ずつ含む', () => {
    const domains: Big5Domain[] = [
      'extraversion',
      'agreeableness',
      'conscientiousness',
      'emotionalStability',
      'intellect',
    ]
    for (const domain of domains) {
      expect(
        IPIP_BFM_50_JA_BRIEF15.items.filter((item) => item.domain === domain)
      ).toHaveLength(3)
    }
  })

  it('全50項目版の displayOrder 1〜15 と完全に一致する（項目文言の改変なし・独自抜粋なし）', () => {
    const fullFirst15 = getItemsInDisplayOrder(IPIP_BFM_50_JA).slice(0, 15)
    expect(IPIP_BFM_50_JA_BRIEF15.items).toEqual(
      expect.arrayContaining(fullFirst15)
    )
    expect(IPIP_BFM_50_JA_BRIEF15.items).toHaveLength(fullFirst15.length)
  })

  it('scaleCode が50項目版と異なる（バージョン・データを混同しないため）', () => {
    expect(IPIP_BFM_50_JA_BRIEF15.scaleCode).toBe('ipip-bfm-50-ja-brief15')
    expect(IPIP_BFM_50_JA_BRIEF15.scaleCode).not.toBe(IPIP_BFM_50_JA.scaleCode)
  })

  it('簡易版自体は未検証である旨の注記(excerptCaveat)を持つ', () => {
    expect(IPIP_BFM_50_JA_BRIEF15.excerptCaveat).toBeDefined()
    expect(IPIP_BFM_50_JA_BRIEF15.excerptCaveat?.length).toBeGreaterThan(0)
  })

  it('getScaleDefinition("brief") で簡易版、"full" で50項目版を返す', () => {
    expect(getScaleDefinition('brief')).toBe(IPIP_BFM_50_JA_BRIEF15)
    expect(getScaleDefinition('full')).toBe(IPIP_BFM_50_JA)
  })
})
