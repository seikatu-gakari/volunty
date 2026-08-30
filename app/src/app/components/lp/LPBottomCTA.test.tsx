import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPBottomCTA } from "./LPBottomCTA";

describe("LPBottomCTA", () => {
  it("診断と活動一覧の実在する導線を表示する", () => {
    const { container } = render(<LPBottomCTA />);

    const primaryCTA = screen.getByRole("link", { name: /無料で簡易診断を試す/ });
    expect(primaryCTA.getAttribute("href")).toBe("/diagnosis/trial");
    expect(primaryCTA.className).toContain("text-primary-dark");
    expect(
      screen.getByRole("link", { name: /募集中の活動を見る/ }).getAttribute("href"),
    ).toBe("/opportunities");
    expect(screen.getByText(/ボランティで見つけよう/)).toBeDefined();
    expect(container.querySelector("section")?.className).toContain("bg-primary-dark");
    expect(screen.getByText("START YOUR ACTION").className).toContain("text-white");
    expect(screen.getByText(/まずは約2分の簡易診断から/).className).toContain(
      "text-white",
    );
  });
});
