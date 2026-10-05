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
  it("ホーム・開始通知・ページ内セクションへの導線を持つ", () => {
    render(<LPFooter />);

    for (const [name, href] of [
      ["ボランティ ホーム", "/"],
      ["無料で事前登録", "#waitlist"],
      ["活動スタイル", "#types"],
      ["団体の方へ", "#waitlist"],
      ["使い方ガイド", "#usage"],
      ["よくある質問", "#faq"],
    ]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
    }
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });
});
