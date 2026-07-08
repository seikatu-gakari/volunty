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
  it("差し替え可能なアプリUIプレビュー画像を表示する", () => {
    render(<LPHeroSection />);

    const image = screen.getByRole("img", {
      name: "Voluntyの診断結果とおすすめ活動を表示したアプリ画面",
    });

    expect(image.getAttribute("src")).toBe("/lp/volunty-match-preview.png");
    expect(image.getAttribute("data-priority")).toBe("true");
  });

  it("診断開始CTAのリンクを維持する", () => {
    render(<LPHeroSection />);

    expect(
      screen
        .getByRole("link", { name: /登録前に簡易診断を試す/ })
        .getAttribute("href"),
    ).toBe("/diagnosis/trial");
    expect(
      screen.getByRole("link", { name: /募集中の活動を見る/ }).getAttribute("href"),
    ).toBe("/opportunities");
  });
});
