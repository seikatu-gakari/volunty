import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PublicHeaderNavigation } from "./PublicHeaderNavigation";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe("PublicHeaderNavigation", () => {
  it("閉じたモバイルヘッダーではログインを隠し、ハンバーガーを表示する", () => {
    render(<PublicHeaderNavigation />);

    const login = screen.getByRole("link", { name: "ログイン" });
    expect(login.getAttribute("href")).toBe("/login");
    expect(login.className).toContain("hidden");
    expect(login.className).toContain("lg:inline-flex");

    const trigger = screen.getByRole("button", { name: "メニューを開く" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.className).toContain("lg:hidden");
    expect(trigger.className).toContain("border-card-border");

    const desktopSignup = screen.getByRole("link", { name: "無料で始める" });
    expect(desktopSignup.className).toContain("lg:inline-flex");
    expect(desktopSignup.className).toContain("bg-primary-dark");
    expect(desktopSignup.className).toContain("hover:bg-text-dark");
    expect(screen.queryByRole("navigation", { name: "モバイルナビゲーション" })).toBeNull();
  });

  it("開いたモバイルメニュー内でログインと無料登録を利用できる", () => {
    render(<PublicHeaderNavigation />);

    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(
      screen.getByRole("button", { name: "メニューを閉じる" }).getAttribute("aria-expanded"),
    ).toBe("true");
    const mobileNavigation = screen.getByRole("navigation", {
      name: "モバイルナビゲーション",
    });
    const mobileMenu = mobileNavigation.parentElement;
    expect(mobileMenu?.className).toContain("w-[calc(100vw-2rem)]");
    expect(mobileMenu?.className).toContain("right-0");
    expect(mobileMenu?.className).toContain("left-auto");
    expect(mobileNavigation.querySelector('a[href="/login"]')).not.toBeNull();
    expect(mobileNavigation.querySelector('a[href="/signup"]')).not.toBeNull();
    expect(mobileNavigation.querySelector('a[href="#usage"]')).not.toBeNull();
  });

  it("メニュー内リンクを選ぶとメニューを閉じる", () => {
    render(<PublicHeaderNavigation />);

    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "モバイルナビゲーション" }),
      ).getByRole("link", { name: "よくある質問" }),
    );

    expect(screen.getByRole("button", { name: "メニューを開く" })).toBeDefined();
  });
});
