import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LPFooter } from "./LPFooter";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

describe("LPFooter", () => {
  it("実在する遷移先にリンクする", () => {
    render(<LPFooter />);

    expect(
      screen.getByRole("link", { name: "性格傾向チェック" }).getAttribute("href"),
    ).toBe("/diagnosis");
    expect(
      screen.getByRole("link", { name: "活動を探す" }).getAttribute("href"),
    ).toBe("/opportunities");
    expect(
      screen.getByRole("link", { name: "団体の方へ" }).getAttribute("href"),
    ).toBe("/signup");
    expect(
      screen.getByRole("link", { name: "使い方ガイド" }).getAttribute("href"),
    ).toBe("#usage");
    expect(
      screen.getByRole("link", { name: "よくある質問" }).getAttribute("href"),
    ).toBe("#faq");
  });

  it("プレースホルダーリンクと未実装ページへのリンクを含まない", () => {
    render(<LPFooter />);

    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link.getAttribute("href")).not.toBe("#");
    }
    expect(screen.queryByText("運営会社")).toBeNull();
    expect(screen.queryByText("プライバシーポリシー")).toBeNull();
    expect(screen.queryByText("利用規約")).toBeNull();
    expect(screen.queryByText("お問い合わせ")).toBeNull();
  });

  it("カタカナのブランド名と現在年を表示する", () => {
    render(<LPFooter />);

    expect(screen.getByRole("link", { name: "ボランティ ホーム" })).toBeDefined();
    expect(document.querySelector('[data-testid="brand-heart"]')).not.toBeNull();
    expect(document.querySelector('img[src="/lp/mobile/brand-mark.png"]')).toBeNull();
    expect(screen.getByText(/© 2026 ボランティ/)).toBeDefined();
    expect(screen.queryByText(/Volunty/)).toBeNull();
  });
});
