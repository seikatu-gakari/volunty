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
  it("初期状態ではメニューを閉じ、ログインと登録の導線を持つ", () => {
    render(<PublicHeaderNavigation />);

    expect(screen.getByRole("link", { name: "ログイン" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "無料で始める" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("button", { name: "メニューを開く" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "モバイルナビゲーション" })).toBeNull();
  });

  it("メニューを開閉し、ログイン・登録・ページ内リンクを利用できる", () => {
    render(<PublicHeaderNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    const closeButton = screen.getByRole("button", { name: "メニューを閉じる" });
    expect(closeButton.getAttribute("aria-expanded")).toBe("true");
    const navigation = within(screen.getByRole("navigation", { name: "モバイルナビゲーション" }));
    for (const [name, href] of [["ログイン", "/login"], ["無料で始める", "/signup"], ["使い方", "#usage"]]) {
      expect(navigation.getByRole("link", { name }).getAttribute("href")).toBe(href);
    }

    fireEvent.click(closeButton);
    expect(screen.getByRole("button", { name: "メニューを開く" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "モバイルナビゲーション" })).toBeNull();
  });

  it("メニュー内リンクを選ぶとメニューを閉じる", () => {
    render(<PublicHeaderNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "モバイルナビゲーション" }))
        .getByRole("link", { name: "よくある質問" }),
    );

    expect(screen.getByRole("button", { name: "メニューを開く" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "モバイルナビゲーション" })).toBeNull();
  });
});
