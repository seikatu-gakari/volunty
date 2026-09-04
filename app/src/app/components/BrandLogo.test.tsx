import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("公式マークと正式名称を1組だけ表示する", () => {
    const { container } = render(<BrandLogo />);

    expect(screen.getAllByText("ボランティ")).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="brand-heart"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="brand-sparkles"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    expect(container.querySelector('img[src="/lp/mobile/brand-mark.png"]')).toBeNull();
  });
});
