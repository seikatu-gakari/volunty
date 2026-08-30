import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mocks.getClaims },
    from: mocks.from,
  })),
}));

import { getViewerContext } from "./viewer-context";

describe("getViewerContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("検証済みclaimsだけから最小identityを作り、DB roleと埋め込みプロフィールを一度だけ取得する", async () => {
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "participant-1",
          email: "participant@example.com",
          user_metadata: { full_name: "参加者 太郎", role: "admin" },
        },
      },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        is_active: true,
        role: "participant",
        m_participant_profile: [{ id: "participant-profile-1" }],
        m_organization_profile: {
          id: "organization-profile-1",
          verified: false,
          review_status: "pending",
        },
      },
      error: null,
    });

    await expect(getViewerContext()).resolves.toEqual({
      status: "authenticated",
      identity: {
        id: "participant-1",
        email: "participant@example.com",
        displayName: "参加者 太郎",
      },
      role: "participant",
      isActive: true,
      hasParticipantProfile: true,
      hasOrganizationProfile: true,
      organizationVerified: false,
      organizationReviewStatus: "pending",
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("m_user");
    expect(mocks.select).toHaveBeenCalledWith(
      "is_active,role,m_participant_profile(id),m_organization_profile(id,verified,review_status)",
    );
    expect(mocks.eq).toHaveBeenCalledWith("id", "participant-1");
  });

  it("claimsがない場合はDBを読まずguestを返す", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });

    await expect(getViewerContext()).resolves.toEqual({ status: "guest" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("account照会エラーはidentityを含むerrorとして返す", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: "user@example.com" } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(getViewerContext()).resolves.toEqual({
      status: "error",
      identity: {
        id: "user-1",
        email: "user@example.com",
        displayName: null,
      },
      errorCode: "account_lookup_failed",
    });
  });
});
