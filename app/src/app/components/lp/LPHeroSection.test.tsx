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

    const mobileOrganicRadius =
      "rounded-[42%_58%_46%_54%/24%_32%_68%_76%]";
    const desktopOrganicRadius =
      "lg:rounded-[34%_66%_40%_60%/30%_22%_78%_70%]";

    expect(image.className).toContain(mobileOrganicRadius);
    expect(image.className).toContain(desktopOrganicRadius);
    expect(image.parentElement?.className).toContain(mobileOrganicRadius);
    expect(image.parentElement?.className).toContain(desktopOrganicRadius);
    expect(image.className).not.toContain(
      "rounded-[2.15rem_2.15rem_2.15rem_0.75rem]",
    );
  });

  it("モバイルLPの見出しとCTA導線を表示する", () => {
    render(<LPHeroSection />);

    expect(
      screen.getByRole("heading", { name: "つながる、みつかる、変わっていく。" }),
    ).toBeDefined();
    const primaryCTA = screen.getByRole("link", { name: /無料で簡易診断を試す/ });
    expect(primaryCTA.getAttribute("href")).toBe("/diagnosis/trial");
    expect(primaryCTA.className).toContain("bg-primary-dark");
    expect(primaryCTA.className).toContain("hover:bg-text-dark");
    expect(primaryCTA.className).toContain("whitespace-nowrap");
    expect(primaryCTA.className).toContain("lg:px-2");
    expect(primaryCTA.className).toContain("lg:text-[13px]");
    expect(primaryCTA.className).toContain("xl:px-6");
    expect(primaryCTA.className).toContain("xl:text-base");

    const secondaryCTA = screen.getByRole("link", { name: /募集中の活動を見る/ });
    expect(secondaryCTA.getAttribute("href")).toBe("/opportunities");
    expect(secondaryCTA.className).toContain("border-primary-dark");
    expect(secondaryCTA.className).toContain("text-primary-dark");
    expect(secondaryCTA.className).toContain("hover:text-text-dark");
    expect(secondaryCTA.className).toContain("whitespace-nowrap");
    expect(secondaryCTA.className).toContain("lg:px-2");
    expect(secondaryCTA.className).toContain("lg:text-[13px]");
    expect(secondaryCTA.className).toContain("xl:px-6");
    expect(secondaryCTA.className).toContain("xl:text-base");
    expect(screen.getByText("登録・診断は無料")).toBeDefined();
    expect(screen.getByText("約2分でできる")).toBeDefined();
    expect(screen.getByText("スマホ・PC対応")).toBeDefined();

    const orbit = screen.getByTestId("lp-hero-photo-orbit");
    const trustItem = screen.getByText("登録・診断は無料");

    expect(
      primaryCTA.compareDocumentPosition(orbit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      orbit.compareDocumentPosition(trustItem) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });
});
