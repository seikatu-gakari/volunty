import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DashboardData } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

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
                order: (...orderArgs: unknown[]) => {
                  mockOrder(...orderArgs);
                  return mockOrder();
                },
              };
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

  it("案件がある場合、応募者数付きで返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    const mockOpportunities = [
      {
        id: "opp-1",
        title: "環境保全ボランティア",
        status: "open",
        created_at: "2026-01-15T00:00:00Z",
        applications: [{ id: "app-1" }, { id: "app-2" }, { id: "app-3" }],
      },
      {
        id: "opp-2",
        title: "子ども支援イベント",
        status: "closed",
        created_at: "2026-01-10T00:00:00Z",
        applications: [{ id: "app-4" }],
      },
    ];

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockOrder.mockReturnValue({ data: mockOpportunities });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toHaveLength(2);

    // 1件目: open、応募者3件
    const opp1 = result.opportunities[0];
    expect(opp1.id).toBe("opp-1");
    expect(opp1.title).toBe("環境保全ボランティア");
    expect(opp1.status).toBe("open");
    expect(opp1.application_count).toBe(3);
    expect(opp1.created_at).toBe("2026-01-15T00:00:00Z");

    // 2件目: closed、応募者1件
    const opp2 = result.opportunities[1];
    expect(opp2.id).toBe("opp-2");
    expect(opp2.title).toBe("子ども支援イベント");
    expect(opp2.status).toBe("closed");
    expect(opp2.application_count).toBe(1);

    // Supabase クエリの検証
    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    expect(mockEq).toHaveBeenCalledWith("organization_id", "org-123");
  });

  it("応募がない案件は application_count が 0 になる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    const mockOpportunities = [
      {
        id: "opp-3",
        title: "新規案件",
        status: "open",
        created_at: "2026-02-01T00:00:00Z",
        applications: [],
      },
    ];

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockOrder.mockReturnValue({ data: mockOpportunities });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].application_count).toBe(0);
  });

  it("applications が null の場合も application_count が 0 になる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    const mockOpportunities = [
      {
        id: "opp-4",
        title: "テスト案件",
        status: "open",
        created_at: "2026-02-01T00:00:00Z",
        applications: null,
      },
    ];

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockOrder.mockReturnValue({ data: mockOpportunities });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].application_count).toBe(0);
  });

  it("案件が0件の場合、空配列を返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockOrder.mockReturnValue({ data: [] });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toEqual([]);
  });

  it("DB エラー時もクラッシュせず空データを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockOrder.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: DashboardData = await fetchMyOpportunities();

    expect(result.opportunities).toEqual([]);
  });
});
