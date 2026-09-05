import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockFindOrganizationProfile = vi.fn();
const mockFindOwnedApplication = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationProfile: {
      findUnique: (...args: unknown[]) => mockFindOrganizationProfile(...args),
    },
    matchingCandidate: {
      findFirst: (...args: unknown[]) => mockFindOwnedApplication(...args),
    },
  },
}));

const { fetchApplicantDetailQuery } = await import("./queries");

const organizationProfile = {
  id: "organization-profile-1",
  reviewStatus: "approved",
  user: { role: "organization" },
};

const acceptedApplication = {
  id: "application-1",
  status: "accepted",
  message: "応募メッセージです",
  appliedAt: new Date("2026-01-20T00:00:00.000Z"),
  statusChangedAt: new Date("2026-01-20T00:00:00.000Z"),
  participant: {
    name: "ユーザー名",
    participantProfile: {
      name: "プロフィール名",
      lineId: "participant-line-id",
      latestDiagnosisResult: { styleTypeId: "supporter-care" },
    },
  },
  opportunity: {
    id: "opportunity-1",
    title: "環境保全ボランティア",
  },
};

describe("fetchApplicantDetailQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOrganizationProfile.mockResolvedValue(organizationProfile);
    mockFindOwnedApplication.mockResolvedValue(acceptedApplication);
  });

  it("承認済み応募では自団体の応募者LINE IDを返す", async () => {
    const result = await fetchApplicantDetailQuery(
      "organization-user-1",
      "application-1",
    );

    expect(result.data?.participant_line_id).toBe("participant-line-id");
    expect(mockFindOwnedApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          participant: {
            select: expect.objectContaining({
              participantProfile: {
                select: expect.objectContaining({ lineId: true }),
              },
            }),
          },
        }),
      }),
    );
  });

  it.each(["applied", "declined"])(
    "%s の応募では応募者LINE IDを返さない",
    async (status) => {
      mockFindOwnedApplication.mockResolvedValue({
        ...acceptedApplication,
        status,
      });

      const result = await fetchApplicantDetailQuery(
        "organization-user-1",
        "application-1",
      );

      expect(result.data).not.toHaveProperty("participant_line_id");
    },
  );
});
