import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityStyleId } from "@/lib/diagnosis-scale/types";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import { DiagnosisTypesCarousel } from "./DiagnosisTypesCarousel";

const FEATURED_STYLE_IDS = [
  "supporter-care",
  "adventure-explorer",
  "harmony-mediator",
  "creative-solo",
] as const satisfies readonly ActivityStyleId[];

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

describe("DiagnosisTypesCarousel", () => {
  it("左右の操作ボタンを表示しない", () => {
    render(<DiagnosisTypesCarousel />);

    expect(screen.queryByRole("button", { name: "前へ" })).toBeNull();
    expect(screen.queryByRole("button", { name: "次へ" })).toBeNull();
  });

  it("4つの代表的な活動スタイルを写真付きで表示する", () => {
    const { container } = render(<DiagnosisTypesCarousel />);

    for (const id of FEATURED_STYLE_IDS) {
      const source = findStyleTypeById(id);
      expect(source).toBeDefined();
      expect(screen.getByText(source!.name.replace(/タイプ$/, "傾向"))).toBeDefined();
    }
    expect(container.querySelectorAll(".lp-carousel-card")).toHaveLength(4);
    expect(
      container.querySelector('[aria-label="代表的な活動スタイル"]')?.className,
    ).toContain("lp-carousel");
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  it("各活動スタイルから簡易診断へ進める", () => {
    render(<DiagnosisTypesCarousel />);

    const links = screen.getAllByRole("link", { name: /診断で詳しく見る/ });
    expect(links).toHaveLength(4);
    expect(links.every((link) => link.getAttribute("href") === "/diagnosis/trial")).toBe(
      true,
    );
  });

  it("JavaScriptのタイマーでスクロール位置を更新しない", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<DiagnosisTypesCarousel />);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
