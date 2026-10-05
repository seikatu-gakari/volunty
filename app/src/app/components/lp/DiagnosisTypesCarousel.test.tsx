import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagnosisTypesCarousel } from "./DiagnosisTypesCarousel";

describe("DiagnosisTypesCarousel", () => {
  it("4つの代表活動スタイルから開始通知へ進める", () => {
    render(<DiagnosisTypesCarousel />);

    const links = screen.getAllByRole("link", { name: /開始通知を受け取る/ });
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("#waitlist");
    }
  });
});
