import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { participantProfile: { findUnique } } }))
import { fetchDiagnosisResultQuery } from './queries'
const scores = { extraversion: 75, agreeableness: 75, conscientiousness: 75, emotionalStability: 50, intellect: 50 }
beforeEach(() => vi.clearAllMocks())
describe('保存分類の読込契約', () => {
  it.each([
    ['v2:neutral', '2.0.0', 'neutral'],
    ['v2:e-high,a-high,c-high', '2.0.0', 'mixed'],
    ['supporter-care', '1.0.0', undefined],
  ])('%s はスコアから再分類しない', async (styleTypeId, styleTypeVersion, classificationKind) => {
    findUnique.mockResolvedValue({ latestDiagnosisResult: { scaledScores: scores, rawScores: scores, scaleCode: 'ipip-bfm-50-ja', scaleVersion: '1.0.0', styleTypeId, styleTypeVersion, qualityFlags: ['too_fast', 'unknown'], answeredAt: new Date('2026-10-05T00:00:00Z') } })
    const result = await fetchDiagnosisResultQuery('user-1')
    expect(result?.styleType?.id).toBe(styleTypeId)
    expect(result?.styleType?.classificationKind).toBe(classificationKind)
    expect(result?.scaledScores).toEqual(scores)
    expect(result?.qualityFlags).toEqual(['too_fast'])
    expect(findUnique.mock.calls[0][0].select.latestDiagnosisResult.select.styleTypeVersion).toBe(true)
  })
  it('未知の分類版でも実測スコアは失わない', async () => {
    findUnique.mockResolvedValue({ latestDiagnosisResult: { scaledScores: scores, rawScores: scores, scaleCode: 'ipip-bfm-50-ja', scaleVersion: '1.0.0', styleTypeId: 'v2:neutral', styleTypeVersion: '3.0.0', qualityFlags: [], answeredAt: new Date() } })
    const result = await fetchDiagnosisResultQuery('user-1')
    expect(result?.styleType).toBeNull()
    expect(result?.scaledScores).toEqual(scores)
  })
})
