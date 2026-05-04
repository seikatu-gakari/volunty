import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DashboardData } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                single: () => mockSingle(),
                eq: (...eq2Args: unknown[]) => {
                  mockEq(...eq2Args);
                  return {
                    single: () => mockSingle(),
                  };
                },
                order: (...orderArgs: unknown[]) => {
                  mockOrder(...orderArgs);
                  return mockOrder();
                },
                in: (...inArgs: unknown[]) => {
                  mockIn(...inArgs);
                  return mockIn();
                },
              };
            },
            in: (...inArgs: unknown[]) => {
              mockIn(...inArgs);
              return mockIn();
            },
          };
        },
      };
    },
  }),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchMyOpportunities } = await import("./actions");

describe("fetchMyOpportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、空のデータを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toEqual([]);
  });

  it("団体プロフィールが見つからない場合、空のデータを返す", async () => {
    const mockUser = { id: "user-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockSingle.mockReturnValue({ data: null, error: { message: "Not found" } });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toEqual([]);
    expect(mockFrom).toHaveBeenCalledWith("m_organization_profile");
  });

  it("案件がある場合、応募者数付きで返す", async () => {
    const mockUser = { id: "user-123", email: "org@example.com" };
    const mockOppData = [
      {
        id: "opp-1",
        title: "環境保全ボランティア",
        status: "published",
        created_at: "2026-01-15T00:00:00Z",
      },
      {
        id: "opp-2",
        title: "子ども支援イベント",
        status: "closed",
        created_at: "2026-01-10T00:00:00Z",
      },
    ];
    const mockMatchings = [
      { opportunity_id: "opp-1" },
      { opportunity_id: "opp-1" },
      { opportunity_id: "opp-1" },
      { opportunity_id: "opp-2" },
    ];

    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    // m_organization_profile single
    mockSingle.mockReturnValue({ data: { id: "profile-123" }, error: null });
    // m_opportunity order
    mockOrder.mockReturnValue({ data: mockOppData, error: null });
    // t_matching_candidate in
    mockIn.mockReturnValue({ data: mockMatchings, error: null });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toHaveLength(2);

    const opp1 = result.opportunities[0];
    expect(opp1.id).toBe("opp-1");
    expect(opp1.title).toBe("環境保全ボランティア");
    expect(opp1.status).toBe("published");
    expect(opp1.application_count).toBe(3);
    expect(opp1.created_at).toBe("2026-01-15T00:00:00Z");

    const opp2 = result.opportunities[1];
    expect(opp2.id).toBe("opp-2");
    expect(opp2.status).toBe("closed");
    expect(opp2.application_count).toBe(1);

    expect(mockFrom).toHaveBeenCalledWith("m_organization_profile");
    expect(mockFrom).toHaveBeenCalledWith("m_opportunity");
    expect(mockFrom).toHaveBeenCalledWith("t_matching_candidate");
    expect(mockEq).toHaveBeenCalledWith("organization_id", "profile-123");
  });

  it("応募がない案件は application_count が 0 になる", async () => {
    const mockUser = { id: "user-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValue({ data: { id: "profile-123" }, error: null });
    mockOrder.mockReturnValue({
      data: [
        {
          id: "opp-3",
          title: "新規案件",
          status: "published",
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      error: null,
    });
    mockIn.mockReturnValue({ data: [], error: null });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].application_count).toBe(0);
  });

  it("案件が0件の場合、空配列を返す", async () => {
    const mockUser = { id: "user-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValue({ data: { id: "profile-123" }, error: null });
    mockOrder.mockReturnValue({ data: [], error: null });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toEqual([]);
  });

  it("DB エラー時もクラッシュせず空データを返す", async () => {
    const mockUser = { id: "user-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toEqual([]);
  });
});

