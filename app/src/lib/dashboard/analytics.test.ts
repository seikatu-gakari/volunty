import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardAnalyticsResult } from "./types";

vi.mock("server-only", () => ({}));

const mockGetUser = vi.fn();
const mockFindOrganization = vi.fn();
const mockFindOpportunities = vi.fn();
const mockGroupMatching = vi.fn();
const mockGroupViews = vi.fn();
const mockGroupApproaches = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationProfile: {
      findUnique: (...args: unknown[]) => mockFindOrganization(...args),
    },
    opportunity: {
      findMany: (...args: unknown[]) => mockFindOpportunities(...args),
    },
    matchingCandidate: {
      groupBy: (...args: unknown[]) => mockGroupMatching(...args),
    },
    engagementEvent: {
      groupBy: (...args: unknown[]) => mockGroupViews(...args),
    },
    approach: {
      groupBy: (...args: unknown[]) => mockGroupApproaches(...args),
    },
  },
}));

const { fetchDashboardAnalytics } = await import("./actions");

describe("fetchDashboardAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } } });
    mockFindOrganization.mockResolvedValue({
      id: "org-profile-1",
      reviewStatus: "approved",
      user: { role: "organization" },
    });
  });

  it("自団体の案件別指標とアプローチ指標を集計する", async () => {
    mockFindOpportunities.mockResolvedValue([
      { id: "opp-1", title: "環境保全" },
      { id: "opp-2", title: "子ども支援" },
    ]);
    mockGroupMatching.mockResolvedValue([
      { opportunityId: "opp-1", status: "applied", _count: { _all: 2 } },
      { opportunityId: "opp-1", status: "accepted", _count: { _all: 1 } },
      { opportunityId: "opp-1", status: "completed", _count: { _all: 1 } },
      { opportunityId: "opp-1", status: "declined", _count: { _all: 1 } },
    ]);
    mockGroupViews.mockResolvedValue([
      { opportunityId: "opp-1", _count: { _all: 7 } },
      { opportunityId: "opp-2", _count: { _all: 3 } },
    ]);
    mockGroupApproaches.mockResolvedValue([
      { status: "sent", _count: { _all: 4 } },
      { status: "accepted", _count: { _all: 2 } },
      { status: "declined", _count: { _all: 1 } },
    ]);

    const result: DashboardAnalyticsResult = await fetchDashboardAnalytics();

    expect(result.opportunities).toEqual([
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
    ]);
    expect(result.approaches).toEqual({
      sentTotal: 7,
      acceptedCount: 2,
      acceptanceRate: 29,
      declinedCount: 1,
      pendingCount: 4,
    });
    expect(mockFindOpportunities).toHaveBeenCalledWith({
      where: { organizationId: "org-profile-1" },
      select: { id: true, title: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  });
});
