import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    opportunity: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { fetchPublicOpportunities, getOpportunityBadges } = await import(
  "./public-list"
);

describe("fetchPublicOpportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("キーワードをtrimしてタイトル・説明・団体名検索に使う", async () => {
    mockFindMany.mockResolvedValue([]);

    await fetchPublicOpportunities({ q: "  清掃  " });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "published",
          publishedAt: { lte: expect.any(Date) },
          AND: [
            {
              OR: [
                { title: { contains: "清掃", mode: "insensitive" } },
                { description: { contains: "清掃", mode: "insensitive" } },
                {
                  organization: {
                    organizationName: { contains: "清掃", mode: "insensitive" },
                  },
                },
              ],
            },
          ],
        }),
      })
    );
  });

  it("参加形態 online では hybrid も含める", async () => {
    mockFindMany.mockResolvedValue([]);

    await fetchPublicOpportunities({ participationMode: "online" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          participationMode: { in: ["online", "hybrid"] },
        }),
      })
    );
  });

  it("初心者歓迎は必須資格なしの案件に絞る", async () => {
    mockFindMany.mockResolvedValue([]);

    await fetchPublicOpportunities({ beginner: true });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { requiredQualifications: { equals: Prisma.JsonNull } },
                { requiredQualifications: { equals: [] } },
              ],
            },
          ],
        }),
      })
    );
  });
});

describe("getOpportunityBadges", () => {
  it("残枠と開始日までの日数を返す", () => {
    const badges = getOpportunityBadges(
      {
        capacity: 10,
        currentApplicants: 7,
        startDate: new Date("2026-07-10T00:00:00.000Z"),
      },
      new Date("2026-07-08T00:00:00.000Z")
    );

    expect(badges).toEqual(["残り3枠", "開始まであと2日"]);
  });

  it("満員の場合は満員バッジを返す", () => {
    const badges = getOpportunityBadges({
      capacity: 5,
      currentApplicants: 5,
      startDate: null,
    });

    expect(badges).toEqual(["満員"]);
  });
});
