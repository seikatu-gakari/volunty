import { findDirectionCharacter } from "@/lib/diagnosis-scale/style-characters";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ACTIVITY_STYLE_DIRECTIONS } from "@/lib/diagnosis-scale/activity-styles";
import { DiagnosisTypesCarousel } from "./DiagnosisTypesCarousel";

describe("DiagnosisTypesCarousel", () => {
  it("4つの方向の紹介から開始通知へ進める", () => {
    render(<DiagnosisTypesCarousel />);

    const links = screen.getAllByRole("link", { name: /無料で事前登録/ });
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("#waitlist");
    }
  });

  it("特性の両方向を中立な共通定義で紹介し、同じ対応の動物画像を装飾として表示する", () => {
    render(<DiagnosisTypesCarousel />);

    const featuredIds = ["e-high", "e-low", "i-high", "i-low"];
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    for (const direction of ACTIVITY_STYLE_DIRECTIONS.filter(({ id }) => featuredIds.includes(id))) {
      expect(screen.getByRole("heading", { name: findDirectionCharacter(direction.id)!.name })).toBeDefined();
      expect(screen.getByText(direction.description)).toBeDefined();
    }
    const images = document.querySelectorAll("article img");
    expect(images).toHaveLength(4);
    expect(Array.from(images).every((image) => image.getAttribute("alt") === "")).toBe(true);
    expect(screen.getByText(/回答を理解するための補助ラベル/)).toBeDefined();
    expect(screen.getByText(/科学的に確立された10類型ではありません/)).toBeDefined();
    expect(screen.getByText(/中央付近（中立）や複数の方向（混合）/)).toBeDefined();
    expect(screen.queryByText(/サポーター・ケア|アドベンチャー・エクスプローラー|ハーモニー・メディエーター|クリエイティブ・ソロ/)).toBeNull();
  });
});
