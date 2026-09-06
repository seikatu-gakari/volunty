import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("公式マークと名称を表示し、装飾は読み上げ対象から外す", () => {
    render(<BrandLogo />);

    expect(screen.getByText("ボランティ")).toBeDefined();
    for (const mark of ["brand-heart", "brand-sparkles"]) {
      expect(screen.getByTestId(mark).getAttribute("aria-hidden")).toBe("true");
    }
  });
});
