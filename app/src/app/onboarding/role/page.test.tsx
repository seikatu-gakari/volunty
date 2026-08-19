import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  roleSelectionClient: vi.fn(),
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

vi.mock("./RoleSelectionClient", () => ({
  RoleSelectionClient: () => {
    mocks.roleSelectionClient();
    return <div>ロール選択UI</div>;
  },
}));

vi.mock("@/app/components/ui/CommonErrorDisplay", () => ({
  CommonErrorDisplay: ({ title }: { title?: string }) => (
    <div role="alert">{title ?? "エラー画面"}</div>
  ),
}));

import OnboardingRolePage from "./page";

describe("OnboardingRolePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: { role: "participant", onboarding_completed: true },
        },
      },
    });
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: { role: "participant" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("role設定済みparticipantでもプロフィール未登録ならロール選択UIを表示する", async () => {
    render(await OnboardingRolePage());

    expect(screen.getByText("ロール選択UI")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.from).toHaveBeenNthCalledWith(1, "m_user");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "m_participant_profile");
  });

  it("role設定済みorganizationでもプロフィール未登録ならロール選択UIを表示する", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "organization-user-1",
          user_metadata: { role: "organization" },
        },
      },
    });
    mocks.maybeSingle
      .mockReset()
      .mockResolvedValueOnce({ data: { role: "organization" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    render(await OnboardingRolePage());

    expect(screen.getByText("ロール選択UI")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.from).toHaveBeenNthCalledWith(2, "m_organization_profile");
  });

  it("metadata roleがなくてもDB roleとプロフィールが未登録ならロール選択UIを表示する", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "metadata-role-missing-1",
          user_metadata: {},
        },
      },
    });

    render(await OnboardingRolePage());

    expect(screen.getByText("ロール選択UI")).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("対応プロフィールがある場合はトップへリダイレクトする", async () => {
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { role: "participant" }, error: null })
      .mockResolvedValueOnce({ data: { id: "participant-profile-1" }, error: null });

    await expect(OnboardingRolePage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("adminはプロフィール確認なしでトップへリダイレクトする", async () => {
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle.mockResolvedValueOnce({ data: { role: "admin" }, error: null });

    await expect(OnboardingRolePage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(mocks.redirect).toHaveBeenCalledWith("/");
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.roleSelectionClient).not.toHaveBeenCalled();
  });

  it("m_user照会エラー時はロール選択UIを表示せずエラー画面を表示する", async () => {
    mocks.maybeSingle.mockReset().mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });

    render(await OnboardingRolePage());

    expect(screen.queryByText("ロール選択UI")).toBeNull();
    expect(screen.getByRole("alert")).toBeDefined();
    expect(mocks.roleSelectionClient).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("プロフィール照会エラー時はロール選択UIを表示せずエラー画面を表示する", async () => {
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { role: "participant" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "permission denied" },
      });

    render(await OnboardingRolePage());

    expect(screen.queryByText("ロール選択UI")).toBeNull();
    expect(screen.getByRole("alert")).toBeDefined();
    expect(mocks.roleSelectionClient).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("未認証の場合はログインへリダイレクトする", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });

    await expect(OnboardingRolePage()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
