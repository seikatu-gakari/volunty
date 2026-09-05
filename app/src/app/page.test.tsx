import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getViewerContext: vi.fn(),
  header: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: mocks.getViewerContext,
}));

vi.mock("./components/Header", () => ({
  Header: (props: { variant?: string; viewerContext?: unknown }) => {
    mocks.header(props);
    return <header>ヘッダー</header>;
  },
}));

vi.mock("./components/AuthenticatedHome", () => ({
  AuthenticatedHome: ({ identity, role }: {
    identity: { displayName: string | null };
    role: string | null;
  }) => <div>認証済みホーム:{identity.displayName ?? "none"}:{role ?? "none"}</div>,
}));

vi.mock("./components/lp/Reveal", () => ({ Reveal: () => null }));
vi.mock("./components/lp/LPHeroSection", () => ({ LPHeroSection: () => null }));
vi.mock("./components/lp/DiagnosisTypesCarousel", () => ({ DiagnosisTypesCarousel: () => null }));
vi.mock("./components/lp/DiagnosisTypesGrid", () => ({ DiagnosisTypesGrid: () => null }));
vi.mock("./components/lp/PainPointsSection", () => ({ PainPointsSection: () => null }));
vi.mock("./components/lp/UsageSection", () => ({ UsageSection: () => null }));
vi.mock("./components/lp/BenefitsSection", () => ({ BenefitsSection: () => null }));
vi.mock("./components/lp/FeaturesSection", () => ({ FeaturesSection: () => null }));
vi.mock("./components/lp/FAQSection", () => ({ FAQSection: () => null }));
vi.mock("./components/lp/LPBottomCTA", () => ({ LPBottomCTA: () => null }));
vi.mock("./components/lp/LPFooter", () => ({ LPFooter: () => null }));

import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue({ status: "guest" });
  });

  it("プロフィール未登録の参加者をロール選択へ送る", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "authenticated",
      identity: { id: "participant-1", email: "p@example.com", displayName: "参加者" },
      role: "participant",
      isActive: true,
      hasParticipantProfile: false,
      hasOrganizationProfile: false,
      organizationVerified: false,
      organizationReviewStatus: null,
    });

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/onboarding/role");
    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/role");
  });

  it("同じviewer contextをHeaderと認証済みホームへ渡す", async () => {
    const viewer = {
      status: "authenticated" as const,
      identity: { id: "participant-1", email: "p@example.com", displayName: "参加者" },
      role: "participant" as const,
      isActive: true,
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
      organizationVerified: false,
      organizationReviewStatus: null,
    };
    mocks.getViewerContext.mockResolvedValue(viewer);

    render(await Home());

    expect(screen.getByText("認証済みホーム:参加者:participant")).toBeDefined();
    expect(mocks.header).toHaveBeenCalledWith({ variant: "landing", viewerContext: viewer });
    expect(mocks.getViewerContext).toHaveBeenCalledTimes(1);
  });

  it("認証済みviewerのaccount照会エラーをLPへフォールバックせず送出する", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "error",
      identity: { id: "user-1", email: "user@example.com", displayName: "利用者" },
      errorCode: "account_lookup_failed",
    });

    await expect(Home()).rejects.toThrow("認証状態の確認に失敗しました");
    expect(mocks.header).not.toHaveBeenCalled();
  });
});
