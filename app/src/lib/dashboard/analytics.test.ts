import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardAnalyticsResult } from "./types";

vi.mock("server-only", () => ({}));

const mockGetUser = vi.fn();
const mockFetchDashboardAnalyticsQuery = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("./queries", () => ({
  fetchDashboardAnalyticsQuery: (...args: unknown[]) =>
    mockFetchDashboardAnalyticsQuery(...args),
  fetchMatchingHistoryQuery: vi.fn(),
  fetchRecommendedParticipantDetailQuery: vi.fn(),
  fetchRecommendedParticipantsQuery: vi.fn(),
}));

const { fetchDashboardAnalytics } = await import("./actions");

describe("fetchDashboardAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } } });
    mockFetchDashboardAnalyticsQuery.mockResolvedValue({
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
  });

  it("認証済みuserIdを同じQueryへ委譲する", async () => {
    const expected: DashboardAnalyticsResult = {
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
    };
    mockFetchDashboardAnalyticsQuery.mockResolvedValue(expected);

    const result = await fetchDashboardAnalytics();

    expect(result).toEqual(expected);
    expect(mockFetchDashboardAnalyticsQuery).toHaveBeenCalledWith("org-user-1");
  });

  it("未認証の場合は失敗結果を返してQueryへ委譲しない", async () => {
    mockGetUser.mockReturnValue({ data: { user: null }, error: null });

    const result = await fetchDashboardAnalytics();

    expect(result).toEqual({ success: false, error: "ログインが必要です" });
    expect(mockFetchDashboardAnalyticsQuery).not.toHaveBeenCalled();
  });
});
