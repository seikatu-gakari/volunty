import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyPageData } from "@/lib/mypage/types";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  fetchMyPageData: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mocks.getUser(),
    },
  }),
}));

vi.mock("@/app/components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

vi.mock("./DeleteAccountForm", () => ({
  DeleteAccountForm: () => <div>削除フォーム</div>,
}));

vi.mock("@/lib/mypage/actions", () => ({
  fetchMyPageData: (...args: unknown[]) => mocks.fetchMyPageData(...args),
}));

vi.mock("@/lib/account-deletion/config", () => ({
  isAccountDeletionEnabled: () => true,
}));

import MyPage from "./page";

const profile: NonNullable<MyPageData["profile"]> = {
  id: "participant-1",
  name: "参加者テスト",
  region: "東京都",
  diagnosis_completed: false,
  diagnosis_style_type_label: null,
  diagnosis_answered_at: null,
};

describe("MyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mocks.fetchMyPageData.mockResolvedValue({
      profile,
      applications: [],
      alert: null,
    } satisfies MyPageData);
  });

  it("参加者登録後のマイページに性格傾向チェック開始カードを表示する", async () => {
    const page = await MyPage();
    render(page);

    expect(
      screen.getByRole("heading", { name: "性格傾向チェックを始める" }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /診断を始める/ }).getAttribute("href"),
    ).toBe("/diagnosis");
    expect(
      screen.getByText("簡易診断（15問・約2分）/ 全50問（約5〜8分）から選べます"),
    ).toBeDefined();
  });

  it("参加者登録前は性格傾向チェック開始カードを表示しない", async () => {
    mocks.fetchMyPageData.mockResolvedValueOnce({
      profile: null,
      applications: [],
      alert: null,
    } satisfies MyPageData);

    const page = await MyPage();
    render(page);

    expect(screen.queryByText("性格傾向チェックを始める")).toBeNull();
    expect(screen.queryByText("診断を始める")).toBeNull();
  });

  it("応募日を日本時間で表示する", async () => {
    mocks.fetchMyPageData.mockResolvedValueOnce({
      profile,
      applications: [
        {
          id: "application-1",
          status: "approved",
          message: null,
          created_at: "2026-07-14T16:10:00.000",
          completed_at: null,
          can_request_certificate: false,
          opportunity: {
            id: "opportunity-1",
            title: "清掃活動",
            organization_name: "テスト団体",
            organization_line_id: "@test",
          },
        },
      ],
      alert: null,
    } satisfies MyPageData);

    const page = await MyPage();
    render(page);

    expect(screen.getByText("応募日: 2026/7/15")).toBeDefined();
  });

  it("未ログインユーザーはログイン画面へリダイレクトする", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });

    await expect(MyPage()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.fetchMyPageData).not.toHaveBeenCalled();
  });
});
