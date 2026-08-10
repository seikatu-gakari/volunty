import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroPhotoFrame } from "./HeroPhotoFrame";

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    priority,
    sizes,
    src,
  }: {
    alt: string;
    className?: string;
    priority?: boolean;
    sizes?: string;
    src: string;
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

describe("HeroPhotoFrame", () => {
  it("ヒーロー写真を1枚だけ優先表示する", () => {
    render(<HeroPhotoFrame />);

    const frame = screen.getByTestId("lp-hero-photo-frame");
    const image = screen.getByRole("img", {
      name: "清掃活動を終えて笑顔でハイタッチするボランティア",
    });

    expect(frame).toBeDefined();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(image.getAttribute("src")).toBe("/lp/mobile/hero-high-five.png");
    expect(image.getAttribute("data-priority")).toBe("true");
    expect(image.getAttribute("data-sizes")).toBe(
      "(min-width: 1280px) 640px, (min-width: 1024px) 48vw, 100vw",
    );
  });

  it("写真の代替文言とモバイル・PC向けサイズを指定する", () => {
    render(<HeroPhotoFrame />);

    const image = screen.getByRole("img");
    expect(image.getAttribute("alt")).toBe(
      "清掃活動を終えて笑顔でハイタッチするボランティア",
    );
    expect(image.getAttribute("data-sizes")).toContain("100vw");
    expect(image.getAttribute("data-sizes")).toContain("48vw");
  });

  it("白縁・有機的な角丸・3つの装飾をCSSで表現する", () => {
    render(<HeroPhotoFrame />);

    const frame = screen.getByTestId("lp-hero-photo-frame");
    const image = screen.getByRole("img");
    const decorations = frame.querySelectorAll('[aria-hidden="true"]');

    expect(frame.className).toContain("bg-white");
    expect(frame.className).toContain("border-white");
    expect(frame.className).toContain("shadow-xl");
    expect(frame.className).toContain("ring-1");
    expect(frame.className).toContain(
      "rounded-[28%_34%_26%_31%/16%_18%_16%_20%]",
    );
    expect(image.className).toContain(
      "rounded-[28%_34%_26%_31%/16%_18%_16%_20%]",
    );
    expect(decorations).toHaveLength(3);
    expect(Array.from(decorations).every((decoration) => decoration.className)).toBe(
      true,
    );
  });
});
