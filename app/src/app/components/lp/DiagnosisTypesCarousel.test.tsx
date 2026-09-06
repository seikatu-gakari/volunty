import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagnosisTypesCarousel } from "./DiagnosisTypesCarousel";

describe("DiagnosisTypesCarousel", () => {
  it("各活動スタイルから簡易診断へ進める", () => {
    render(<DiagnosisTypesCarousel />);

    const links = screen.getAllByRole("link", { name: /診断で詳しく見る/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/diagnosis/trial");
    }
  });
});
