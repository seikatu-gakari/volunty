import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPBottomCTA } from "./LPBottomCTA";

describe("LPBottomCTA", () => {
  it("診断と活動一覧の実在する導線を表示する", () => {
    render(<LPBottomCTA />);

    expect(
      screen.getByRole("link", { name: /無料で簡易診断を試す/ }).getAttribute("href"),
    ).toBe("/diagnosis/trial");
    expect(
      screen.getByRole("link", { name: /募集中の活動を見る/ }).getAttribute("href"),
    ).toBe("/opportunities");
    expect(screen.getByText(/ボランティーで見つけよう/)).toBeDefined();
  });
});
