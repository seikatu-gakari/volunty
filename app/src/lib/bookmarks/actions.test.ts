import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFindParticipant = vi.fn();
const mockFindOpportunity = vi.fn();
const mockFindFavorite = vi.fn();
const mockCreateFavorite = vi.fn();
const mockDeleteFavorites = vi.fn();
const mockFindFavorites = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participantProfile: {
      findUnique: (...args: unknown[]) => mockFindParticipant(...args),
    },
    opportunity: {
      findFirst: (...args: unknown[]) => mockFindOpportunity(...args),
    },
    engagementEvent: {
      findFirst: (...args: unknown[]) => mockFindFavorite(...args),
      create: (...args: unknown[]) => mockCreateFavorite(...args),
      deleteMany: (...args: unknown[]) => mockDeleteFavorites(...args),
      findMany: (...args: unknown[]) => mockFindFavorites(...args),
    },
  },
}));

const {
  addBookmark,
  fetchBookmarkedOpportunityIds,
  fetchMyBookmarks,
  removeBookmark,
} = await import("./actions");

describe("bookmark actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } } });
    mockFindParticipant.mockResolvedValue({ id: "participant-1" });
    mockFindOpportunity.mockResolvedValue({ id: "opp-1" });
  });

  it("公開中案件をお気に入りに追加できる", async () => {
    mockFindFavorite.mockResolvedValue(null);
    mockCreateFavorite.mockResolvedValue({ id: "favorite-1" });

    const result = await addBookmark("opp-1");

    expect(result).toEqual({ success: true });
    expect(mockFindOpportunity).toHaveBeenCalledWith({
      where: {
        id: "opp-1",
        status: "published",
        publishedAt: { lte: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(mockCreateFavorite).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        opportunityId: "opp-1",
        event: "favorite",
        source: "search",
      },
      select: { id: true },
    });
  });

  it("重複追加は成功として扱い新規作成しない", async () => {
    mockFindFavorite.mockResolvedValue({ id: "favorite-existing" });

    const result = await addBookmark("opp-1");

    expect(result).toEqual({ success: true });
    expect(mockCreateFavorite).not.toHaveBeenCalled();
  });

  it("お気に入りを解除できる", async () => {
    mockDeleteFavorites.mockResolvedValue({ count: 1 });

    const result = await removeBookmark("opp-1");

    expect(result).toEqual({ success: true });
    expect(mockDeleteFavorites).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        opportunityId: "opp-1",
        event: "favorite",
      },
    });
  });

  it("addBookmark 後に revalidatePath を呼ぶ", async () => {
    mockFindFavorite.mockResolvedValue(null);
    mockCreateFavorite.mockResolvedValue({ id: "favorite-1" });

    await addBookmark("opp-1");

    expect(mockRevalidatePath).toHaveBeenCalledWith("/mypage/bookmarks");
  });

  it("removeBookmark 後に revalidatePath を呼ぶ", async () => {
    mockDeleteFavorites.mockResolvedValue({ count: 1 });

    await removeBookmark("opp-1");

    expect(mockRevalidatePath).toHaveBeenCalledWith("/mypage/bookmarks");
  });

  it("指定した案件 ID のお気に入り済み ID セットを返す", async () => {
    mockFindFavorites.mockResolvedValue([
      { opportunityId: "opp-1" },
      { opportunityId: "opp-3" },
    ]);

    const result = await fetchBookmarkedOpportunityIds([
      "opp-1",
      "opp-2",
      "opp-3",
    ]);

    expect(result).toEqual(new Set(["opp-1", "opp-3"]));
    expect(mockFindFavorites).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        opportunityId: { in: ["opp-1", "opp-2", "opp-3"] },
        event: "favorite",
      },
      select: { opportunityId: true },
    });
  });

  it("未ログイン時は空セットを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    const result = await fetchBookmarkedOpportunityIds(["opp-1"]);

    expect(result).toEqual(new Set());
  });

  it("本人のお気に入り一覧を取得できる", async () => {
    mockFindFavorites.mockResolvedValue([
      {
        opportunity: {
          id: "opp-1",
          title: "清掃活動",
          description: "駅前を清掃します",
          organization: { organizationName: "テスト団体" },
        },
      },
    ]);

    const result = await fetchMyBookmarks();

    expect(result.bookmarks).toEqual([
      {
        id: "opp-1",
        title: "清掃活動",
        description: "駅前を清掃します",
        organizationName: "テスト団体",
      },
    ]);
  });
});
