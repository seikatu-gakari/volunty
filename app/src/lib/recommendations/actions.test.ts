import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DomainScores } from "@/lib/diagnosis-scale/types"

const mockGetUser = vi.fn()
const mockFindParticipant = vi.fn()
const mockFindOpportunities = vi.fn()
const mockRecommendationLogCreate = vi.fn()
const mockTransaction = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participantProfile: {
      findUnique: (...args: unknown[]) => mockFindParticipant(...args),
    },
    opportunity: {
      findMany: (...args: unknown[]) => mockFindOpportunities(...args),
    },
    recommendationLog: {
      create: (...args: unknown[]) => mockRecommendationLogCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

const { fetchRecommendations } = await import("./actions")

const scaledScores: DomainScores = {
  extraversion: 80,
  agreeableness: 70,
  conscientiousness: 60,
  emotionalStability: 50,
  intellect: 40,
}

type MockOpportunity = {
  id: string
  title: string
  description: string | null
  location: string | null
  category: string | null
  participationMode: "online" | "offline" | "hybrid" | null
  activityStyleTags: string[] | null
  startDate: Date | null
  endDate: Date | null
  publishedAt: Date | null
  capacity: number | null
  currentApplicants: number
  minAge: number | null
  maxAge: number | null
  organization: {
    organizationName: string
    activityAreas: string[] | null
  }
}

function createOpportunity({
  id,
  ...overrides
}: Partial<MockOpportunity> & { id: string }): MockOpportunity {
  return {
    id,
    title: `${id} の案件`,
    description: null,
    location: "東京都渋谷区",
    category: "環境保全",
    participationMode: "offline",
    activityStyleTags: null,
    startDate: null,
    endDate: null,
    publishedAt: new Date(),
    capacity: null,
    currentApplicants: 0,
    minAge: null,
    maxAge: null,
    organization: {
      organizationName: `${id} 団体`,
      activityAreas: ["渋谷区"],
    },
    ...overrides,
  }
}

function participantRecord(overrides: Record<string, unknown> = {}) {
  return {
    interests: ["環境保全"],
    region: "東京都",
    availability: null,
    birthday: new Date("1995-04-01"),
    latestDiagnosisResult: { id: "diag-1", scaledScores },
    ...overrides,
  }
}

describe("fetchRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } } })
    mockFindParticipant.mockResolvedValue(participantRecord())
    // $transaction は create の呼び出し配列を受け取り、ログIDを返す
    mockTransaction.mockImplementation(async (operations: unknown[]) =>
      operations.map((_, i) => ({ id: `log-${i + 1}`, opportunityId: `opp-${i + 1}` }))
    )
  })

  it("未ログインの場合、空の結果を返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } })

    const result = await fetchRecommendations()

    expect(result).toEqual({ recommendations: [], hasCompletedDiagnosis: false })
    expect(mockFindOpportunities).not.toHaveBeenCalled()
  })

  it("参加者プロフィールがない場合、空の結果を返す", async () => {
    mockFindParticipant.mockResolvedValue(null)

    const result = await fetchRecommendations()

    expect(result).toEqual({ recommendations: [], hasCompletedDiagnosis: false })
  })

  it("未診断でも推薦は返り、hasCompletedDiagnosis は false になる", async () => {
    mockFindParticipant.mockResolvedValue(
      participantRecord({ latestDiagnosisResult: null })
    )
    mockFindOpportunities.mockResolvedValue([createOpportunity({ id: "opp-1" })])

    const result = await fetchRecommendations()

    expect(result.hasCompletedDiagnosis).toBe(false)
    expect(result.recommendations).toHaveLength(1)
  })

  it("興味分野に一致する案件が上位になり、推薦理由が付く", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({ id: "other", category: "子ども支援" }),
      createOpportunity({ id: "matched", category: "環境保全" }),
    ])

    const result = await fetchRecommendations()

    expect(result.recommendations[0].id).toBe("matched")
    expect(result.recommendations[0].reasons[0]).toContain("環境保全")
  })

  it("終了した案件・定員に達した案件はハード条件で除外される", async () => {
    const past = new Date("2020-01-01")
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({ id: "ended", endDate: past }),
      createOpportunity({ id: "full", capacity: 5, currentApplicants: 5 }),
      createOpportunity({ id: "open" }),
    ])

    const result = await fetchRecommendations()

    expect(result.recommendations.map((r) => r.id)).toEqual(["open"])
  })

  it("category フィルタが機能する", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({ id: "env", category: "環境保全" }),
      createOpportunity({ id: "kids", category: "子ども支援" }),
    ])

    const result = await fetchRecommendations({ category: "子ども支援" })

    expect(result.recommendations.map((r) => r.id)).toEqual(["kids"])
  })

  it("participationMode フィルタで hybrid 案件は両方に合致する", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({ id: "online-opp", participationMode: "online" }),
      createOpportunity({ id: "hybrid-opp", participationMode: "hybrid" }),
      createOpportunity({ id: "offline-opp", participationMode: "offline" }),
    ])

    const result = await fetchRecommendations({ participationMode: "online" })

    expect(new Set(result.recommendations.map((r) => r.id))).toEqual(
      new Set(["online-opp", "hybrid-opp"])
    )
  })

  it("表示した推薦を推薦ログとして記録する", async () => {
    mockFindOpportunities.mockResolvedValue([createOpportunity({ id: "opp-1" })])

    await fetchRecommendations()

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockRecommendationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          opportunityId: "opp-1",
          rank: 1,
          matchingRuleVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
          diagnosisResultId: "diag-1",
        }),
      })
    )
  })

  it("推薦ログの記録に失敗しても推薦は返る", async () => {
    mockFindOpportunities.mockResolvedValue([createOpportunity({ id: "opp-1" })])
    mockTransaction.mockRejectedValue(new Error("log failed"))

    const result = await fetchRecommendations()

    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].recommendationLogId).toBeNull()
  })

  it("予期しないエラー時は空の結果を返す", async () => {
    mockFindParticipant.mockRejectedValue(new Error("db down"))

    const result = await fetchRecommendations()

    expect(result).toEqual({ recommendations: [], hasCompletedDiagnosis: false })
  })
})
