import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LPPaperStage } from "./LPPaperStage";

const VARIANTS = ["hero", "journey", "styles", "trust"] as const;

describe("LPPaperStage", () => {
  it("rail背景を外側へ広げて中央の読み取り面を保つ", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const backdropRule = stylesheet.match(/\.lp-paper-stage__backdrop\s*\{([\s\S]*?)\}/)?.[1];

    expect(backdropRule).toContain("background-size: 100% auto, 140% auto, 100% auto;");
  });

  it.each([
    ["journey", "top left, center top, bottom right"],
    ["styles", "top right, center top, bottom left"],
    ["trust", "top center, center top, bottom center"],
  ] as const)("%s variantのrail背景を中央に固定する", (variant, backgroundPosition) => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const variantRule = stylesheet.match(
      new RegExp(`\\.lp-paper-stage--${variant}\\s*\\{([\\s\\S]*?)\\}`),
    )?.[1];

    expect(variantRule).toContain(`background-position: ${backgroundPosition};`);
  });

  it("heroのPhoto Orbit背面へdividerを流す", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const heroFlowRule = stylesheet.match(/\.lp-paper-stage--hero::after\s*\{([\s\S]*?)\}/)?.[1];

    expect(heroFlowRule).toContain('url("/images/lp/paper-waves/divider-mobile.webp")');
    expect(heroFlowRule).toContain("top: 520px;");
  });

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
