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
  it("ホーム・各機能・ページ内セクションへの導線を持つ", () => {
    render(<LPFooter />);

    for (const [name, href] of [
      ["ボランティ ホーム", "/"],
      ["性格傾向チェック", "/diagnosis"],
      ["活動を探す", "/opportunities"],
      ["団体の方へ", "/signup"],
      ["使い方ガイド", "#usage"],
      ["よくある質問", "#faq"],
      ["利用規約", "/terms"],
      ["プライバシーポリシー", "/privacy"],
      ["運営者情報", "/operator"],
      ["お問い合わせ", "/contact"],
      ["安全・通報方針", "/safety"],
      ["退会・データ削除", "/account-deletion"],
    ]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
    }
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });
});
