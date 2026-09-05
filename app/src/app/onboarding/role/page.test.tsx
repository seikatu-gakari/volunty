import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getViewerContext: vi.fn(),
  roleSelectionClient: vi.fn(),
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

vi.mock("./RoleSelectionClient", () => ({
  RoleSelectionClient: () => {
    mocks.roleSelectionClient();
    return <div>ロール選択UI</div>;
  },
}));

import OnboardingRolePage from "./page";

const participantViewer = {
  status: "authenticated" as const,
  identity: {
    id: "user-1",
    email: "user@example.com",
    displayName: "利用者",
  },
  role: "participant" as const,
  isActive: true,
  hasParticipantProfile: false,
  hasOrganizationProfile: false,
  organizationVerified: false,
  organizationReviewStatus: null,
};

describe("OnboardingRolePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerContext.mockResolvedValue(participantViewer);
  });

  it("プロフィール未登録の参加者にはロール選択UIを表示する", async () => {
    render(await OnboardingRolePage());

    expect(screen.getByText("ロール選択UI")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("プロフィール未登録の団体にもロール選択UIを表示する", async () => {
    mocks.getViewerContext.mockResolvedValue({
      ...participantViewer,
      role: "organization",
    });

    render(await OnboardingRolePage());

    expect(screen.getByText("ロール選択UI")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("ロール未選択の場合はロール選択UIを表示する", async () => {
    mocks.getViewerContext.mockResolvedValue({ ...participantViewer, role: null });

    render(await OnboardingRolePage());

    expect(screen.getByText("ロール選択UI")).toBeDefined();
  });

  it("対応プロフィールがある場合はトップへリダイレクトする", async () => {
    mocks.getViewerContext.mockResolvedValue({
      ...participantViewer,
      hasParticipantProfile: true,
    });

    await expect(OnboardingRolePage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("adminはプロフィール確認なしでトップへリダイレクトする", async () => {
    mocks.getViewerContext.mockResolvedValue({
      ...participantViewer,
      role: "admin",
    });

    await expect(OnboardingRolePage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(mocks.redirect).toHaveBeenCalledWith("/");
    expect(mocks.roleSelectionClient).not.toHaveBeenCalled();
  });

  it("ViewerContext errorをroute errorとして送出する", async () => {
    mocks.getViewerContext.mockResolvedValue({
      status: "error",
      errorCode: "account_lookup_failed",
    });

    await expect(OnboardingRolePage()).rejects.toThrow(
      "閲覧者情報を確認できませんでした"
    );

    expect(mocks.roleSelectionClient).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("未認証の場合はログインへリダイレクトする", async () => {
    mocks.getViewerContext.mockResolvedValue({ status: "guest" });

    await expect(OnboardingRolePage()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
