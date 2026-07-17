import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PublicHeaderNavigation } from "./PublicHeaderNavigation";

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, className }: {
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
  it("ログイン導線とモバイルメニューを表示する", () => {
    render(<PublicHeaderNavigation />);

    expect(screen.getByRole("link", { name: "ログイン" }).getAttribute("href")).toBe(
      "/login",
    );

    const trigger = screen.getByRole("button", { name: "メニューを開く" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.className).toContain("lg:hidden");

    const desktopSignup = screen.getByRole("link", { name: "無料で始める" });
    expect(desktopSignup.className).toContain("lg:inline-flex");
    expect(desktopSignup.className).toContain("bg-primary-dark");
    expect(desktopSignup.className).toContain("hover:bg-text-dark");

    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "メニューを閉じる" })).toBeDefined();
    expect(
      screen
        .getAllByRole("link", { name: "無料で始める" })
        .every((link) => link.getAttribute("href") === "/signup"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "無料で始める" })
        .every((link) => link.className.includes("bg-primary-dark")),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "無料で始める" })
        .every((link) => link.className.includes("hover:bg-text-dark")),
    ).toBe(true);
    expect(
      screen.getByRole("navigation", { name: "モバイルナビゲーション" })
        .parentElement?.className,
    ).toContain("lg:hidden");
    expect(screen.getByRole("link", { name: "使い方" }).getAttribute("href")).toBe(
      "#usage",
    );
  });

  it("メニュー内リンクを選ぶとメニューを閉じる", () => {
    render(<PublicHeaderNavigation />);

    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
    fireEvent.click(screen.getByRole("link", { name: "よくある質問" }));

    expect(screen.getByRole("button", { name: "メニューを開く" })).toBeDefined();
  });
});
