import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetUser = vi.fn();
const mockFindUser = vi.fn();
const mockFindParticipantProfile = vi.fn();
const mockFindOrganizationProfile = vi.fn();
const mockFindMatchingCandidate = vi.fn();
const mockFindCertificate = vi.fn();
const mockFindCertificates = vi.fn();
const mockCreateCertificate = vi.fn();
const mockUpdateCertificate = vi.fn();
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
    user: {
      findUnique: (...args: unknown[]) => mockFindUser(...args),
    },
    participantProfile: {
      findUnique: (...args: unknown[]) => mockFindParticipantProfile(...args),
    },
    organizationProfile: {
      findUnique: (...args: unknown[]) => mockFindOrganizationProfile(...args),
    },
    matchingCandidate: {
      findFirst: (...args: unknown[]) => mockFindMatchingCandidate(...args),
    },
    certificate: {
      findUnique: (...args: unknown[]) => mockFindCertificate(...args),
      findFirst: (...args: unknown[]) => mockFindCertificate(...args),
      findMany: (...args: unknown[]) => mockFindCertificates(...args),
      create: (...args: unknown[]) => mockCreateCertificate(...args),
      update: (...args: unknown[]) => mockUpdateCertificate(...args),
    },
  },
}));

const {
  approveCertificate,
  fetchCertificateRequestTarget,
  fetchDashboardCertificates,
  fetchIssuedCertificateForPdf,
  fetchMyCertificates,
  rejectCertificate,
  requestCertificate,
} = await import("./actions");

const completedApplication = {
  id: "application-1",
  participantId: "participant-user-1",
  opportunityId: "opportunity-1",
  status: "completed",
  statusChangedAt: new Date("2026-06-10T09:00:00.000Z"),
  participant: {
    id: "participant-user-1",
    participantProfile: { name: "山田 花子" },
  },
  opportunity: {
    id: "opportunity-1",
    title: "地域清掃ボランティア",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-06-01T00:00:00.000Z"),
    organizationId: "organization-profile-1",
    organization: {
      id: "organization-profile-1",
      organizationName: "NPO法人テスト",
    },
  },
};

const issuedCertificate = {
  id: "certificate-1",
  applicationId: "application-1",
  participantId: "participant-user-1",
  organizationId: "organization-profile-1",
  opportunityId: "opportunity-1",
  status: "issued",
  certificateNumber: "VOL-20260618-0001",
  requestedAt: new Date("2026-06-11T00:00:00.000Z"),
  approvedAt: new Date("2026-06-18T01:00:00.000Z"),
  issuedAt: new Date("2026-06-18T01:00:00.000Z"),
  rejectedAt: null,
  rejectionReason: null,
  application: completedApplication,
  participant: completedApplication.participant,
  organization: completedApplication.opportunity.organization,
  opportunity: completedApplication.opportunity,
};

describe("certificates actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T01:23:45.000Z"));
    mockGetUser.mockReturnValue({
      data: { user: { id: "participant-user-1" } },
      error: null,
    });
    mockFindParticipantProfile.mockResolvedValue({
      id: "participant-profile-1",
      userId: "participant-user-1",
      name: "山田 花子",
    });
    mockFindOrganizationProfile.mockResolvedValue({
      id: "organization-profile-1",
      userId: "organization-user-1",
      organizationName: "NPO法人テスト",
      reviewStatus: "approved",
    });
    mockFindUser.mockResolvedValue({ role: "participant" });
    mockFindMatchingCandidate.mockResolvedValue(completedApplication);
    mockFindCertificate.mockResolvedValue(null);
    mockFindCertificates.mockResolvedValue([]);
    mockCreateCertificate.mockResolvedValue({
      id: "certificate-1",
      applicationId: "application-1",
    });
    mockUpdateCertificate.mockResolvedValue(issuedCertificate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("活動完了済みの本人応募だけ証明書申請対象として返す", async () => {
    const result = await fetchCertificateRequestTarget("application-1");

    expect(result).toEqual({
      target: expect.objectContaining({
        applicationId: "application-1",
        participantName: "山田 花子",
        organizationName: "NPO法人テスト",
        opportunityTitle: "地域清掃ボランティア",
        completedAt: "2026-06-10T09:00:00.000Z",
      }),
    });
    expect(mockFindMatchingCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "application-1",
          participantId: "participant-user-1",
          status: "completed",
        }),
      })
    );
  });

  it("活動完了前の応募は証明書を申請できない", async () => {
    mockFindMatchingCandidate.mockResolvedValue(null);

    const result = await requestCertificate("application-1");

    expect(result).toEqual({
      success: false,
      error: "活動完了済みの応募のみ証明書を申請できます",
    });
    expect(mockCreateCertificate).not.toHaveBeenCalled();
  });

  it("同じ応募で重複申請できない", async () => {
    mockFindCertificate.mockResolvedValue(issuedCertificate);

    const result = await requestCertificate("application-1");

    expect(result).toEqual({
      success: false,
      error: "この応募の証明書はすでに申請済みです",
    });
    expect(mockCreateCertificate).not.toHaveBeenCalled();
  });

  it("活動完了済み応募の証明書を申請できる", async () => {
    const result = await requestCertificate("application-1");

    expect(result).toEqual({ success: true, certificateId: "certificate-1" });
    expect(mockCreateCertificate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: "application-1",
        participantId: "participant-user-1",
        organizationId: "organization-profile-1",
        opportunityId: "opportunity-1",
        status: "pending",
      }),
      select: { id: true },
    });
  });

  it("参加者は自分の証明書一覧を確認できる", async () => {
    mockFindCertificates.mockResolvedValue([issuedCertificate]);

    const result = await fetchMyCertificates();

    expect(result.certificates).toHaveLength(1);
    expect(result.certificates[0]).toEqual(
      expect.objectContaining({
        id: "certificate-1",
        status: "issued",
        certificateNumber: "VOL-20260618-0001",
        participantName: "山田 花子",
        organizationName: "NPO法人テスト",
        opportunityTitle: "地域清掃ボランティア",
      })
    );
    expect(mockFindCertificates).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participantId: "participant-user-1" },
      })
    );
  });

  it("団体は自団体の証明書申請一覧を確認できる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "organization-user-1" } },
      error: null,
    });
    mockFindCertificates.mockResolvedValue([issuedCertificate]);

    const result = await fetchDashboardCertificates();

    expect(result.certificates).toHaveLength(1);
    expect(mockFindCertificates).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "organization-profile-1" },
      })
    );
  });

  it("該当団体は申請を承認すると即発行できる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "organization-user-1" } },
      error: null,
    });
    mockFindCertificate.mockResolvedValue({
      ...issuedCertificate,
      status: "pending",
      certificateNumber: null,
      approvedAt: null,
      issuedAt: null,
    });

    const result = await approveCertificate("certificate-1");

    expect(result).toEqual({ success: true, certificateId: "certificate-1" });
    expect(mockUpdateCertificate).toHaveBeenCalledWith({
      where: { id: "certificate-1" },
      data: expect.objectContaining({
        status: "issued",
        approvedAt: new Date("2026-06-18T01:23:45.000Z"),
        issuedAt: new Date("2026-06-18T01:23:45.000Z"),
        certificateNumber: expect.stringMatching(/^VOL-20260618-/),
      }),
      select: expect.any(Object),
    });
  });

  it("該当団体以外は申請を承認できない", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "other-organization-user" } },
      error: null,
    });
    mockFindOrganizationProfile.mockResolvedValue({
      id: "other-organization-profile",
      userId: "other-organization-user",
      organizationName: "別団体",
      reviewStatus: "approved",
    });
    mockFindCertificate.mockResolvedValue({
      ...issuedCertificate,
      status: "pending",
      certificateNumber: null,
      organizationId: "organization-profile-1",
    });

    const result = await approveCertificate("certificate-1");

    expect(result).toEqual({
      success: false,
      error: "この操作を行う権限がありません",
    });
    expect(mockUpdateCertificate).not.toHaveBeenCalled();
  });

  it("該当団体は理由付きで申請を却下できる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "organization-user-1" } },
      error: null,
    });
    mockFindCertificate.mockResolvedValue({
      ...issuedCertificate,
      status: "pending",
      certificateNumber: null,
    });

    const result = await rejectCertificate("certificate-1", "参加実績を確認できませんでした");

    expect(result).toEqual({ success: true, certificateId: "certificate-1" });
    expect(mockUpdateCertificate).toHaveBeenCalledWith({
      where: { id: "certificate-1" },
      data: expect.objectContaining({
        status: "rejected",
        rejectedAt: new Date("2026-06-18T01:23:45.000Z"),
        rejectionReason: "参加実績を確認できませんでした",
      }),
      select: expect.any(Object),
    });
  });

  it("発行済み証明書だけPDF生成用データとして取得できる", async () => {
    mockFindCertificate.mockResolvedValue(issuedCertificate);

    const result = await fetchIssuedCertificateForPdf("certificate-1");

    expect(result.certificate).toEqual(
      expect.objectContaining({
        id: "certificate-1",
        status: "issued",
        certificateNumber: "VOL-20260618-0001",
        participantName: "山田 花子",
      })
    );
  });

  it("証明書番号がない証明書はPDF生成用データとして返さない", async () => {
    mockFindCertificate.mockResolvedValue({
      ...issuedCertificate,
      certificateNumber: null,
    });

    const result = await fetchIssuedCertificateForPdf("certificate-1");

    expect(result).toEqual({
      certificate: null,
      error: "発行済み証明書が見つかりません",
    });
  });
});
