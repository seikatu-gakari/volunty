import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  userFindUnique: vi.fn(),
  fetchDashboardStats: vi.fn(),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
    },
  },
}));

vi.mock("@/app/components/Header", () => ({
  Header: () => <header>ヘッダー</header>,
}));

vi.mock("@/lib/admin/actions", () => ({
  fetchDashboardStats: (...args: unknown[]) =>
    mocks.fetchDashboardStats(...args),
}));

import AdminDashboardPage from "./page";

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockReturnValue({ data: { user: { id: "admin-1" } } });
    mocks.userFindUnique.mockResolvedValue({ role: "admin" });
    mocks.fetchDashboardStats.mockResolvedValue({
      userCount: 1234,
      matchingCount: 56,
      pendingReviewCount: 7,
    });
  });

  it("管理者にはサマリカードと団体審査導線を表示する", async () => {
    const page = await AdminDashboardPage();
    render(page);

    expect(
      screen.getByRole("heading", { name: "管理ダッシュボード" })
    ).toBeDefined();
    expect(screen.getByText("ユーザー数")).toBeDefined();
    expect(screen.getByText("1,234")).toBeDefined();
    expect(screen.getByText("マッチング数")).toBeDefined();
    expect(screen.getByText("56")).toBeDefined();
    expect(screen.getByText("審査待ち件数")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(
      screen.getByRole("link", { name: /団体審査一覧/ }).getAttribute("href")
    ).toBe("/admin/organizations");
    expect(mocks.fetchDashboardStats).toHaveBeenCalledOnce();
  });

  it("未ログインユーザーはログイン画面へリダイレクトする", async () => {
    mocks.getUser.mockReturnValue({ data: { user: null } });

    await expect(AdminDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.fetchDashboardStats).not.toHaveBeenCalled();
  });

  it("admin 以外のユーザーは forbidden へリダイレクトする", async () => {
    mocks.userFindUnique.mockResolvedValue({ role: "participant" });

    await expect(AdminDashboardPage()).rejects.toThrow(
      "NEXT_REDIRECT:/forbidden"
    );

    expect(mocks.redirect).toHaveBeenCalledWith("/forbidden");
    expect(mocks.fetchDashboardStats).not.toHaveBeenCalled();
  });
});
