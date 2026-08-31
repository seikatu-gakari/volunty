import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getViewerContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: () => mocks.getViewerContext(),
}));

vi.mock("./components/ParticipantProfileForm", () => ({
  ParticipantProfileForm: () => null,
}));

import OnboardingParticipantPage from "./page";

const participantViewer = {
  status: "authenticated" as const,
  identity: {
    id: "participant-user-123",
    email: "participant@example.com",
    displayName: "参加者",
  },
  role: "participant" as const,
  isActive: true,
  hasParticipantProfile: false,
  hasOrganizationProfile: false,
  organizationVerified: false,
  organizationReviewStatus: null,
};

describe("OnboardingParticipantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue(participantViewer);
  });

  it("参加者プロフィール未登録の場合、参加者フォームを表示する", async () => {
    await expect(OnboardingParticipantPage()).resolves.toBeDefined();

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getViewerContext).toHaveBeenCalledOnce();
  });

  it("organization ロールの場合、団体オンボーディングへリダイレクトする", async () => {
    mocks.getViewerContext.mockResolvedValue({
      ...participantViewer,
      role: "organization",
      hasOrganizationProfile: false,
    });

    await expect(OnboardingParticipantPage()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/organization"
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/organization");
  });

  it("ロール未選択の場合、ロール選択画面へリダイレクトする", async () => {
    mocks.getViewerContext.mockResolvedValue({
      ...participantViewer,
      role: null,
    });

    await expect(OnboardingParticipantPage()).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/role"
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/role");
  });

  it("参加者プロフィール登録済みの場合、トップへリダイレクトする", async () => {
    mocks.getViewerContext.mockResolvedValue({
      ...participantViewer,
      hasParticipantProfile: true,
    });

    await expect(OnboardingParticipantPage()).rejects.toThrow(
      "NEXT_REDIRECT:/"
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });
});
