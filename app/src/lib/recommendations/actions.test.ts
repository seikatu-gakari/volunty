import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BIG5Scores } from "@/lib/personality/types"

const mockGetUser = vi.fn()
const mockFindParticipant = vi.fn()
const mockFindOpportunities = vi.fn()

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
  },
}))

const { fetchRecommendations } = await import("./actions")

const diagnosisScores: BIG5Scores = {
  extraversion: 50,
  agreeableness: 50,
  conscientiousness: 50,
  neuroticism: 50,
  openness: 50,
}

type MockOpportunity = {
  id: string
  title: string
  description: string | null
  requirementTraits: Record<string, number> | null
  location: string | null
  organization: {
    organizationName: string
    activityCategories: string[] | null
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
    requirementTraits: { extraversion: 50 },
    location: "東京都渋谷区",
    organization: {
      organizationName: `${id} 団体`,
      activityCategories: ["環境保全"],
      activityAreas: ["渋谷区"],
    },
    ...overrides,
  }
}

describe("fetchRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } } })
    mockFindParticipant.mockResolvedValue({ diagnosisScores })
  })

  it("category が指定された場合、団体の活動カテゴリに一致する案件だけを返す", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({
        id: "env-1",
        organization: {
          organizationName: "環境団体",
          activityCategories: ["環境保全", "地域活動"],
          activityAreas: ["渋谷区"],
        },
      }),
      createOpportunity({
        id: "edu-1",
        organization: {
          organizationName: "教育団体",
          activityCategories: ["教育"],
          activityAreas: ["渋谷区"],
        },
      }),
    ])

    const result = await fetchRecommendations({ category: "環境保全" })

    expect(result.hasCompletedDiagnosis).toBe(true)
    expect(result.recommendations.map((item) => item.id)).toEqual(["env-1"])
  })

  it("region が指定された場合、案件場所または団体活動地域に一致する案件をスコア降順で返す", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({
        id: "area-match",
        requirementTraits: { extraversion: 70 },
        location: "神奈川県横浜市",
        organization: {
          organizationName: "地域団体",
          activityCategories: ["地域活動"],
          activityAreas: ["東京都渋谷区"],
        },
      }),
      createOpportunity({
        id: "location-match",
        requirementTraits: { extraversion: 50 },
        location: "東京都渋谷区",
        organization: {
          organizationName: "場所一致団体",
          activityCategories: ["地域活動"],
          activityAreas: ["世田谷区"],
        },
      }),
      createOpportunity({
        id: "no-match",
        location: "大阪府大阪市",
        organization: {
          organizationName: "対象外団体",
          activityCategories: ["地域活動"],
          activityAreas: ["大阪府"],
        },
      }),
    ])

    const result = await fetchRecommendations({ region: "渋谷区" })

    expect(result.recommendations.map((item) => item.id)).toEqual([
      "location-match",
      "area-match",
    ])
  })

  it("category と region が指定された場合、両方に一致する案件だけを返す", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({
        id: "both-match",
        organization: {
          organizationName: "両方一致団体",
          activityCategories: ["環境保全"],
          activityAreas: ["渋谷区"],
        },
      }),
      createOpportunity({
        id: "category-only",
        location: "大阪府大阪市",
        organization: {
          organizationName: "カテゴリのみ団体",
          activityCategories: ["環境保全"],
          activityAreas: ["大阪府"],
        },
      }),
      createOpportunity({
        id: "region-only",
        organization: {
          organizationName: "地域のみ団体",
          activityCategories: ["教育"],
          activityAreas: ["渋谷区"],
        },
      }),
    ])

    const result = await fetchRecommendations({
      category: "環境保全",
      region: "渋谷区",
    })

    expect(result.recommendations.map((item) => item.id)).toEqual([
      "both-match",
    ])
  })

  it("participationMode が online の場合、オンラインまたはリモートの案件だけを返す", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({
        id: "online-location",
        location: "オンライン",
        organization: {
          organizationName: "オンライン団体",
          activityCategories: ["IT支援"],
          activityAreas: ["全国"],
        },
      }),
      createOpportunity({
        id: "remote-area",
        location: "東京都渋谷区",
        organization: {
          organizationName: "リモート団体",
          activityCategories: ["IT支援"],
          activityAreas: ["リモート"],
        },
      }),
      createOpportunity({
        id: "offline",
        location: "東京都練馬区",
        organization: {
          organizationName: "対面団体",
          activityCategories: ["地域活動"],
          activityAreas: ["練馬区"],
        },
      }),
    ])

    const result = await fetchRecommendations({ participationMode: "online" })

    expect(result.recommendations.map((item) => item.id)).toEqual([
      "online-location",
      "remote-area",
    ])
  })

  it("participationMode が offline の場合、オンラインまたはリモートを含まない案件だけを返す", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({
        id: "online-location",
        location: "オンライン",
        organization: {
          organizationName: "オンライン団体",
          activityCategories: ["IT支援"],
          activityAreas: ["全国"],
        },
      }),
      createOpportunity({
        id: "remote-area",
        location: "東京都渋谷区",
        organization: {
          organizationName: "リモート団体",
          activityCategories: ["IT支援"],
          activityAreas: ["リモート"],
        },
      }),
      createOpportunity({
        id: "offline",
        location: "東京都練馬区",
        organization: {
          organizationName: "対面団体",
          activityCategories: ["地域活動"],
          activityAreas: ["練馬区"],
        },
      }),
    ])

    const result = await fetchRecommendations({ participationMode: "offline" })

    expect(result.recommendations.map((item) => item.id)).toEqual(["offline"])
  })

  it("フィルタ後に該当案件がない場合、診断済みの空結果を返す", async () => {
    mockFindOpportunities.mockResolvedValue([
      createOpportunity({
        id: "edu-1",
        organization: {
          organizationName: "教育団体",
          activityCategories: ["教育"],
          activityAreas: ["渋谷区"],
        },
      }),
    ])

    const result = await fetchRecommendations({ category: "環境保全" })

    expect(result).toEqual({
      recommendations: [],
      hasCompletedDiagnosis: true,
    })
  })
})
