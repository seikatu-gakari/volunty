import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mocks.getUser(),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  }),
}));

vi.mock("./components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

vi.mock("./components/AuthenticatedHome", () => ({
  AuthenticatedHome: ({ role }: { role: string | null }) => (
    <div>認証済みホーム:{role ?? "none"}</div>
  ),
}));

vi.mock("./components/lp/Reveal", () => ({ Reveal: () => null }));
vi.mock("./components/lp/LPHeroSection", () => ({ LPHeroSection: () => null }));
vi.mock("./components/lp/DiagnosisTypesCarousel", () => ({
  DiagnosisTypesCarousel: () => null,
}));
vi.mock("./components/lp/DiagnosisTypesGrid", () => ({
  DiagnosisTypesGrid: () => null,
}));
vi.mock("./components/lp/PainPointsSection", () => ({
  PainPointsSection: () => null,
}));
vi.mock("./components/lp/UsageSection", () => ({ UsageSection: () => null }));
vi.mock("./components/lp/BenefitsSection", () => ({
  BenefitsSection: () => null,
}));
vi.mock("./components/lp/VoicesSection", () => ({ VoicesSection: () => null }));
vi.mock("./components/lp/FeaturesSection", () => ({
  FeaturesSection: () => null,
}));
vi.mock("./components/lp/FAQSection", () => ({ FAQSection: () => null }));
vi.mock("./components/lp/LPBottomCTA", () => ({ LPBottomCTA: () => null }));
vi.mock("./components/lp/LPFooter", () => ({ LPFooter: () => null }));

import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
          user_metadata: { role: "participant", onboarding_completed: true },
        },
      },
    });
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { role: "participant" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("participantプロフィール未登録ならロール選択へリダイレクトする", async () => {
    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/onboarding/role");

    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/role");
  });

  it("organizationプロフィール未登録ならロール選択へリダイレクトする", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "organization-user-1",
          user_metadata: { role: "organization" },
        },
      },
    });
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { role: "organization" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/onboarding/role");

    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/role");
  });

  it("participantプロフィール登録済みなら既存の認証済みホームを表示する", async () => {
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { role: "participant" }, error: null })
      .mockResolvedValueOnce({ data: { id: "participant-profile-1" }, error: null });

    render(await Home());

    expect(screen.getByText("認証済みホーム:participant")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("organizationプロフィール登録済みなら審査状態を維持してホームを表示する", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "organization-user-1",
          user_metadata: { role: "organization", onboarding_completed: false },
        },
      },
    });
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { role: "organization" }, error: null })
      .mockResolvedValueOnce({
        data: { id: "organization-profile-1", verified: false, review_status: "pending" },
        error: null,
      });

    render(await Home());

    expect(screen.getByText("認証済みホーム:organization")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("adminはプロフィールなしでも既存の認証済みホームを表示する", async () => {
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle.mockResolvedValueOnce({ data: { role: "admin" }, error: null });

    render(await Home());

    expect(screen.getByText("認証済みホーム:admin")).toBeDefined();
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("DB role照会エラー時は未完了と誤判定してリダイレクトしない", async () => {
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });

    render(await Home());

    expect(screen.getByText("認証済みホーム:none")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("プロフィール照会エラー時は未登録と誤判定してリダイレクトしない", async () => {
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { role: "organization" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "permission denied" },
      });

    render(await Home());

    expect(screen.getByText("認証済みホーム:organization")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("未認証ユーザーにはゲストLPを表示する", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });

    render(await Home());

    expect(screen.getByRole("banner")).toBeDefined();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
