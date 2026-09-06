import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthenticatedHome } from "./AuthenticatedHome";
import { UsageSection } from "./lp/UsageSection";

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

const identity = {
  id: "test-user",
  email: "test@example.com",
  displayName: "テストユーザー",
};

describe("ホームのロール別導線と診断仕様", () => {
  it("応募者トップに利用できる機能導線を表示する", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="participant"
      />,
    );

    expect(screen.getByRole("link", { name: /マイページ/ }).getAttribute("href")).toBe(
      "/mypage",
    );
    expect(
      screen.getByRole("link", { name: /おすすめ案件/ }).getAttribute("href"),
    ).toBe("/recommendations");
    expect(
      screen.getByRole("link", { name: /性格傾向チェック/ }).getAttribute("href"),
    ).toBe("/diagnosis");
    expect(screen.queryByRole("link", { name: /管理ダッシュボード/ })).toBeNull();
  });

  it("募集団体トップに団体向け機能導線を表示する", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="organization"
        organizationVerified
      />,
    );

    expect(
      screen.getByRole("link", { name: /ダッシュボード/ }).getAttribute("href"),
    ).toBe("/dashboard");
    expect(
      screen.getByRole("link", { name: /新しい案件を作成/ }).getAttribute("href"),
    ).toBe("/dashboard/opportunities/new");
    expect(
      screen.getByRole("link", { name: /おすすめ参加者/ }).getAttribute("href"),
    ).toBe("/dashboard/participants");
    expect(screen.queryByRole("link", { name: /マイページ/ })).toBeNull();
  });

  it("管理者トップに管理機能導線を表示する", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="admin"
      />,
    );

    expect(
      screen.getByRole("link", { name: /管理ダッシュボード/ }).getAttribute("href"),
    ).toBe("/admin");
    expect(
      screen.getByRole("link", { name: /団体審査一覧/ }).getAttribute("href"),
    ).toBe("/admin/organizations");
    expect(
      screen.getByRole("link", { name: /ユーザー管理/ }).getAttribute("href"),
    ).toBe("/admin/users");
    expect(screen.queryByRole("link", { name: /マイページ/ })).toBeNull();
  });

  it("未承認団体には審査状況の確認導線を表示する", () => {
    render(
      <AuthenticatedHome
        identity={identity}
        role="organization"
      />,
    );

    expect(screen.getByRole("link", { name: /審査状況を確認/ }).getAttribute("href")).toBe("/onboarding/pending");
  });

  it("LPの診断説明で簡易15問・全50問の2モード診断仕様を表示する", () => {
    render(<UsageSection />);

    expect(screen.getByText(/簡易15問/)).toBeDefined();
    expect(screen.getByText(/全50問/)).toBeDefined();
  });
});
