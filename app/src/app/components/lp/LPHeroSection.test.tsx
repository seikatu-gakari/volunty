import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LPHeroSection } from "./LPHeroSection";

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

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    className,
    priority,
  }: {
    alt: string;
    src: string;
    className?: string;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      data-priority={priority ? "true" : "false"}
      src={src}
    />
  ),
}));

describe("LPHeroSection", () => {
  it("清掃ボランティアのヒーロー画像を優先表示する", () => {
    render(<LPHeroSection />);

    const image = screen.getByRole("img", {
      name: "公園で清掃ボランティアに参加する若者たち",
    });

    expect(image.getAttribute("src")).toBe("/lp/mobile/hero-cleanup.png");
    expect(image.getAttribute("data-priority")).toBe("true");
  });

  it("モバイルLPの見出しとCTA導線を表示する", () => {
    render(<LPHeroSection />);

    expect(
      screen.getByRole("heading", { name: "つながる、みつかる、変わっていく。" }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: /無料で簡易診断を試す/ })
        .getAttribute("href"),
    ).toBe("/diagnosis/trial");
    expect(
      screen.getByRole("link", { name: /募集中の活動を見る/ }).getAttribute("href"),
    ).toBe("/opportunities");
    expect(screen.getByText("登録・診断は無料")).toBeDefined();
    expect(screen.getByText("約2分でできる")).toBeDefined();
    expect(screen.getByText("スマホ・PC対応")).toBeDefined();
  });
});
