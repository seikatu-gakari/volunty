import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { opportunity: { findFirst } },
}));

const { fetchPublicOpportunityDetail } = await import("./public-detail");

describe("fetchPublicOpportunityDetail", () => {
  beforeEach(() => findFirst.mockReset());

  it("公開済みかつ公開日時を過ぎた募集だけを明示的な公開項目で取得する", async () => {
    findFirst.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      title: "公開募集",
      description: "活動内容",
      activityStyleTags: ["supporter"],
      requiredQualifications: ["資格A"],
      minAge: 18,
      maxAge: 70,
      location: "東京都渋谷区",
      startDate: new Date("2026-09-10T00:00:00Z"),
      endDate: new Date("2026-09-11T00:00:00Z"),
      schedule: "毎週土曜日 10:00〜12:00",
      capacity: 10,
      currentApplicants: 2,
      category: "環境保全",
      participationMode: "offline",
      cost: "交通費のみ自己負担",
      belongings: "飲み物、軍手",
      applicationDeadline: new Date("2026-09-08T00:00:00Z"),
      cancellationPolicy: "前日までに連絡",
      insuranceDetails: "主催者負担で行事保険に加入",
      contactMethod: "応募後にVolunty内で案内",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      organization: {
        organizationName: "公開団体",
        description: "団体説明",
        websiteUrl: "https://example.com",
        verified: true,
      },
    });

    const result = await fetchPublicOpportunityDetail("00000000-0000-4000-8000-000000000001", new Date("2026-09-01T12:00:00Z"));

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "00000000-0000-4000-8000-000000000001",
        status: "published",
        publishedAt: { lte: new Date("2026-09-01T12:00:00Z") },
      },
      select: expect.any(Object),
    }));
    const select = findFirst.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("matchingCandidates");
    expect(select.organization.select).not.toHaveProperty("contactEmail");
    expect(select.organization.select).not.toHaveProperty("contactLineId");
    expect(result).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      organization: { name: "公開団体", verified: true },
      schedule: "毎週土曜日 10:00〜12:00",
      insurance_details: "主催者負担で行事保険に加入",
    });
    expect(result).not.toHaveProperty("applications");
  });

  it("下書き・未来公開・非公開・存在しない募集は null を返す", async () => {
    findFirst.mockResolvedValue(null);
    await expect(fetchPublicOpportunityDetail("00000000-0000-4000-8000-000000000099")).resolves.toBeNull();
  });

  it("UUID形式でない直接URLはDBへ問い合わせず null を返す", async () => {
    await expect(fetchPublicOpportunityDetail("invalid-id")).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
