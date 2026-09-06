import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockFindOrganizationProfile = vi.fn();
const mockFindOwnedApplication = vi.fn();
const mockFindParticipantProfile = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationProfile: {
      findUnique: (...args: unknown[]) => mockFindOrganizationProfile(...args),
    },
    participantProfile: {
      findUnique: (...args: unknown[]) => mockFindParticipantProfile(...args),
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
    id: "participant-1",
    name: "ユーザー名",
    participantProfile: {
      name: "プロフィール名",
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
    mockFindParticipantProfile.mockResolvedValue({ lineId: "participant-line-id" });
  });

  it("承認済み応募では自団体の応募者LINE IDを返す", async () => {
    const result = await fetchApplicantDetailQuery(
      "organization-user-1",
      "application-1",
    );

    expect(result.data?.participant_line_id).toBe("participant-line-id");
    expect(mockFindParticipantProfile).toHaveBeenCalledTimes(1);
    expect(mockFindParticipantProfile).toHaveBeenCalledWith({
      where: { userId: "participant-1" },
      select: { lineId: true },
    });
    expect(mockFindOwnedApplication.mock.calls[0]?.[0]).not.toHaveProperty(
      "select.participant.select.participantProfile.select.lineId"
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
      expect(mockFindParticipantProfile).not.toHaveBeenCalled();
    },
  );
});
