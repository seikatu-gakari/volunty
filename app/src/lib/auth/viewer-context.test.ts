import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheStore: new Map<unknown, Promise<unknown>>(),
  createClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    cache: <T,>(fn: () => Promise<T>) => () => {
      const cached = mocks.cacheStore.get(fn) as Promise<T> | undefined;
      if (cached) {
        return cached;
      }

      const result = fn();
      mocks.cacheStore.set(fn, result);
      return result;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getViewerContext } from "./viewer-context";

describe("getViewerContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheStore.clear();
    mocks.createClient.mockResolvedValue({
      auth: { getClaims: mocks.getClaims },
      from: mocks.from,
    });
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

  it("Supabase初期化に失敗した場合はguestへ偽装せずerrorを返す", async () => {
    mocks.createClient.mockRejectedValue(new Error("Supabase unavailable"));

    await expect(getViewerContext()).resolves.toEqual({
      status: "error",
      errorCode: "auth_unavailable",
    });
  });

  it("claims検証がrejectした場合はguestへ偽装せずerrorを返す", async () => {
    mocks.getClaims.mockRejectedValue(new Error("Auth transport failed"));

    await expect(getViewerContext()).resolves.toEqual({
      status: "error",
      errorCode: "auth_unavailable",
    });
  });

  it("claims検証がerrorを返した場合はDBを読まずerrorを返す", async () => {
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: { message: "Invalid JWT" },
    });

    await expect(getViewerContext()).resolves.toEqual({
      status: "error",
      errorCode: "claims_invalid",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("同一Server Componentリクエスト内の並行呼出しではclaimsとm_userを各一度だけ照会する", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "cached-user-1", email: "cached@example.com" } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        is_active: true,
        role: "participant",
        m_participant_profile: { id: "participant-profile-1" },
        m_organization_profile: null,
      },
      error: null,
    });

    await Promise.all([getViewerContext(), getViewerContext()]);

    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
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
