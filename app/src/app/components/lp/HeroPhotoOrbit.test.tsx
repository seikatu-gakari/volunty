import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroPhotoOrbit } from "./HeroPhotoOrbit";

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

describe("HeroPhotoOrbit", () => {
  it("5つの活動写真を異なる大きさで表示する", () => {
    render(<HeroPhotoOrbit />);

    const orbit = screen.getByTestId("lp-hero-photo-orbit");
    expect(orbit.className).toContain("aspect-square");

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(5);
    expect(images.map((image) => image.getAttribute("alt"))).toEqual([
      "公園で清掃ボランティアに参加する若者たち",
      "地域イベントで受付を支えるボランティア",
      "自然保全活動へ向かうボランティア",
      "子どもから感謝のカードを受け取るボランティア",
      "地域活動について相談するNPOスタッフ",
    ]);
  });

  it("メイン写真だけを優先読み込みし有機的な輪郭を維持する", () => {
    render(<HeroPhotoOrbit />);

    const mainImage = screen.getByRole("img", {
      name: "公園で清掃ボランティアに参加する若者たち",
    });
    expect(mainImage.getAttribute("data-priority")).toBe("true");
    expect(mainImage.className).toContain(
      "rounded-[42%_58%_46%_54%/24%_32%_68%_76%]",
    );

    for (const image of screen.getAllByRole("img").slice(1)) {
      expect(image.getAttribute("data-priority")).toBe("false");
    }
  });

  it("表示上限に合わせたレスポンシブ画像サイズを指定する", () => {
    render(<HeroPhotoOrbit />);

    const [mainImage, ...satelliteImages] = screen.getAllByRole("img");
    expect(mainImage.getAttribute("data-sizes")).toBe(
      "(min-width: 1280px) 510px, (min-width: 1024px) 38vw, (min-width: 640px) 576px, 84vw",
    );
    for (const image of satelliteImages) {
      expect(image.getAttribute("data-sizes")).toBe(
        "(min-width: 1280px) 200px, (min-width: 1024px) 15vw, 31vw",
      );
    }
  });
});
