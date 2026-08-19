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
    sizes,
  }: {
    alt: string;
    src: string;
    className?: string;
    priority?: boolean;
    sizes?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      data-priority={priority ? "true" : "false"}
      data-sizes={sizes}
      src={src}
    />
  ),
}));

describe("LPHeroSection", () => {
  it("単一のヒーロー写真を優先表示し、Photo Orbitを表示しない", () => {
    render(<LPHeroSection />);

    const frame = screen.getByTestId("lp-hero-photo-frame");
    const image = screen.getByRole("img", {
      name: "清掃活動を終えて笑顔でハイタッチするボランティア",
    });

    expect(image.getAttribute("src")).toBe("/lp/mobile/hero-high-five.png");
    expect(image.getAttribute("data-priority")).toBe("true");
    expect(image.getAttribute("data-sizes")).toContain("100vw");
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(frame.parentElement?.className).toContain("lg:col-start-2");
    expect(screen.queryByTestId("lp-hero-photo-orbit")).toBeNull();
  });

  it("参照UIのコピーとCTA導線を表示する", () => {
    render(<LPHeroSection />);

    expect(
      screen.getByRole("heading", { name: "つながる、みつかる、変わっていく。" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "約2分の簡易診断で、あなたらしく続けやすい活動のヒントを見つけよう。",
      ),
    ).toBeDefined();

    const primaryCTA = screen.getByRole("link", {
      name: "2分で自分の活動タイプを知る",
    });
    const primaryCTAClasses = primaryCTA.className.split(/\s+/);
    expect(primaryCTA.getAttribute("href")).toBe("/diagnosis/trial");
    expect(primaryCTAClasses).toContain("bg-primary");
    expect(primaryCTAClasses).toContain("hover:bg-primary-dark");
    expect(primaryCTAClasses).not.toContain("hover:bg-text-dark");
    expect(primaryCTAClasses).toContain("hover:-translate-y-0.5");

    const secondaryCTA = screen.getByRole("link", { name: "活動例を見る" });
    expect(secondaryCTA.getAttribute("href")).toBe("#styles");
    expect(secondaryCTA.className).toContain("border-primary-dark");
    expect(secondaryCTA.className).toContain("text-primary-dark");

    const ctaGroup = primaryCTA.parentElement;
    expect(ctaGroup?.className).toContain("lg:flex");
    expect(ctaGroup?.className).toContain("lg:flex-row");
    expect(ctaGroup?.className).toContain("lg:items-stretch");
  });

  it("モバイルの写真からCTA、安心情報までを指定順で配置する", () => {
    render(<LPHeroSection />);

    const frame = screen.getByTestId("lp-hero-photo-frame");
    const primaryCTA = screen.getByRole("link", {
      name: "2分で自分の活動タイプを知る",
    });
    const secondaryCTA = screen.getByRole("link", { name: "活動例を見る" });
    const trustItem = screen.getByText("登録・診断は無料");

    expect(
      frame.compareDocumentPosition(primaryCTA) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      primaryCTA.compareDocumentPosition(secondaryCTA) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      secondaryCTA.compareDocumentPosition(trustItem) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(screen.getByText("スマホ対応")).toBeDefined();
    expect(screen.getByText("スマホ・PC対応")).toBeDefined();
  });
});
