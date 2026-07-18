import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPPaperStage } from "./LPPaperStage";

const VARIANTS = ["hero", "journey", "styles", "trust"] as const;

describe("LPPaperStage", () => {
  it.each(VARIANTS)("%s variantの背景と子要素を描画する", (variant) => {
    render(
      <LPPaperStage variant={variant}>
        <p>{variant} content</p>
      </LPPaperStage>,
    );

    const stage = screen.getByTestId("lp-paper-stage");
    const backdrop = screen.getByTestId("lp-paper-backdrop");

    expect(stage.getAttribute("data-variant")).toBe(variant);
    expect(stage.className).toContain("bg-lp-cream");
    expect(backdrop.className).toContain(`lp-paper-stage--${variant}`);
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop.className).toContain("pointer-events-none");
    expect(backdrop.className).toContain("z-0");
    expect(backdrop.className).not.toContain("-z-10");
    expect(screen.getByText(`${variant} content`)).toBeDefined();
  });
});
