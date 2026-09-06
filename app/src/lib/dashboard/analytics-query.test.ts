import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  findOrganization: vi.fn(),
  findOpportunities: vi.fn(),
  groupMatching: vi.fn(),
  groupViews: vi.fn(),
  groupApproaches: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationProfile: {
      findUnique: (...args: unknown[]) => mocks.findOrganization(...args),
    },
    opportunity: {
      findMany: (...args: unknown[]) => mocks.findOpportunities(...args),
    },
    matchingCandidate: {
      groupBy: (...args: unknown[]) => mocks.groupMatching(...args),
    },
    engagementEvent: {
      groupBy: (...args: unknown[]) => mocks.groupViews(...args),
    },
    approach: {
      groupBy: (...args: unknown[]) => mocks.groupApproaches(...args),
    },
  },
}));

const { fetchDashboardAnalyticsQuery } = await import("./queries");

function expectAnalyticsFailure(
  result: Awaited<ReturnType<typeof fetchDashboardAnalyticsQuery>>,
) {
  expect(result).toEqual({
    success: false,
    error: "予期しないエラーが発生しました",
  });
  expect(result).not.toHaveProperty("opportunities");
  expect(result).not.toHaveProperty("approaches");
}

describe("fetchDashboardAnalyticsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.headers.mockResolvedValue(new Headers());
    mocks.findOrganization.mockResolvedValue({
      id: "org-profile-1",
      reviewStatus: "approved",
      user: { role: "organization" },
    });
    mocks.findOpportunities.mockResolvedValue([
      { id: "opp-1", title: "環境保全" },
      { id: "opp-2", title: "子ども支援" },
    ]);
    mocks.groupMatching.mockResolvedValue([]);
    mocks.groupViews.mockResolvedValue([]);
    mocks.groupApproaches.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["案件取得", "findOpportunities", "opportunities"],
    ["応募集計", "groupMatching", "matching"],
    ["閲覧集計", "groupViews", "views"],
    ["アプローチ集計", "groupApproaches", "approaches"],
  ] as const)(
    "%sの失敗は数値データを返さず、失敗段階をログに記録する",
    async (_label, mockName, stage) => {
      const error = Object.assign(new Error("内部エラー"), { code: "P2025" });
      mocks[mockName].mockRejectedValue(error);

      const result = await fetchDashboardAnalyticsQuery("user-1");

      expectAnalyticsFailure(result);
      expect(console.error).toHaveBeenCalledWith(
        "dashboard_analytics_failed",
        expect.objectContaining({
          event: "dashboard_analytics_failed",
          stage,
          errorCode: "P2025",
          organizationProfileId: "org-profile-1",
        }),
      );
    },
  );

  it("団体プロフィール取得の失敗も数値データへ変換しない", async () => {
    const error = Object.assign(new Error("内部エラー"), { code: "P1001" });
    mocks.findOrganization.mockRejectedValue(error);

    const result = await fetchDashboardAnalyticsQuery("user-1");

    expectAnalyticsFailure(result);
    expect(console.error).toHaveBeenCalledWith(
      "dashboard_analytics_failed",
      expect.objectContaining({
        event: "dashboard_analytics_failed",
        stage: "organization_profile",
        errorCode: "P1001",
      }),
    );
  });

  it.each([
    [
      "団体以外のロール",
      { user: { role: "participant" }, reviewStatus: "approved" },
      "団体アカウントのみ利用できます",
    ],
    [
      "未承認のプロフィール",
      { user: { role: "organization" }, reviewStatus: "pending" },
      "承認済み団体のみ利用できます",
    ],
  ] as const)(
    "%sは分析データを返さず、取得済みプロフィールIDをログに記録する",
    async (_label, profile, errorMessage) => {
      mocks.findOrganization.mockResolvedValueOnce({
        id: "org-profile-1",
        ...profile,
      });

      const result = await fetchDashboardAnalyticsQuery("user-1");

      expect(result).toEqual({ success: false, error: errorMessage });
      expect(result).not.toHaveProperty("opportunities");
      expect(result).not.toHaveProperty("approaches");
      expect(console.error).toHaveBeenCalledWith(
        "dashboard_analytics_failed",
        expect.objectContaining({
          event: "dashboard_analytics_failed",
          stage: "organization_profile",
          organizationProfileId: "org-profile-1",
        }),
      );
    },
  );

  it("案件と集計対象が0件の正常結果を返す", async () => {
    mocks.findOpportunities.mockResolvedValue([]);

    const result = await fetchDashboardAnalyticsQuery("user-1");

    expect(result).toEqual({
      success: true,
      opportunities: [],
      approaches: {
        sentTotal: 0,
        acceptedCount: 0,
        acceptanceRate: 0,
        declinedCount: 0,
        pendingCount: 0,
      },
    });
    expect(mocks.findOpportunities).toHaveBeenCalledWith({
      where: { organizationId: "org-profile-1" },
      select: { id: true, title: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    expect(mocks.groupMatching).toHaveBeenCalledWith({
      by: ["opportunityId", "status"],
      where: { opportunityId: { in: [] } },
      _count: { _all: true },
    });
    expect(mocks.groupViews).toHaveBeenCalledWith({
      by: ["opportunityId"],
      where: { opportunityId: { in: [] }, event: "view" },
      _count: { _all: true },
    });
    expect(mocks.groupApproaches).toHaveBeenCalledWith({
      by: ["status"],
      where: { organizationId: "org-profile-1" },
      _count: { _all: true },
    });
  });

  it("案件があってイベントが0件の正常結果を返す", async () => {
    const result = await fetchDashboardAnalyticsQuery("user-1");

    expect(result).toMatchObject({
      success: true,
      opportunities: [
        {
          opportunityId: "opp-1",
          title: "環境保全",
          viewCount: 0,
          applicationCount: 0,
          approvedCount: 0,
          approvalRate: 0,
          declinedCount: 0,
          completedCount: 0,
        },
        {
          opportunityId: "opp-2",
          title: "子ども支援",
          viewCount: 0,
          applicationCount: 0,
          approvedCount: 0,
          approvalRate: 0,
          declinedCount: 0,
          completedCount: 0,
        },
      ],
    });
  });

  it("自団体の非ゼロfixtureを既存の計算式で集計する", async () => {
    mocks.groupMatching.mockResolvedValue([
      { opportunityId: "opp-1", status: "applied", _count: { _all: 2 } },
      { opportunityId: "opp-1", status: "accepted", _count: { _all: 1 } },
      { opportunityId: "opp-1", status: "completed", _count: { _all: 1 } },
      { opportunityId: "opp-1", status: "declined", _count: { _all: 1 } },
    ]);
    mocks.groupViews.mockResolvedValue([
      { opportunityId: "opp-1", _count: { _all: 7 } },
      { opportunityId: "opp-2", _count: { _all: 3 } },
    ]);
    mocks.groupApproaches.mockResolvedValue([
      { status: "sent", _count: { _all: 4 } },
      { status: "accepted", _count: { _all: 2 } },
      { status: "declined", _count: { _all: 1 } },
    ]);

    const result = await fetchDashboardAnalyticsQuery("user-1");

    expect(result).toEqual({
      success: true,
      opportunities: [
        {
          opportunityId: "opp-1",
          title: "環境保全",
          viewCount: 7,
          applicationCount: 5,
          approvedCount: 2,
          approvalRate: 40,
          declinedCount: 1,
          completedCount: 1,
        },
        {
          opportunityId: "opp-2",
          title: "子ども支援",
          viewCount: 3,
          applicationCount: 0,
          approvedCount: 0,
          approvalRate: 0,
          declinedCount: 0,
          completedCount: 0,
        },
      ],
      approaches: {
        sentTotal: 7,
        acceptedCount: 2,
        acceptanceRate: 29,
        declinedCount: 1,
        pendingCount: 4,
      },
    });
  });
});
