import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosisTypesCarousel } from "./DiagnosisTypesCarousel";

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

    expect(screen.getByText("サポーター・ケア傾向")).toBeDefined();
    expect(screen.getByText("アドベンチャー・エクスプローラー傾向")).toBeDefined();
    expect(screen.getByText("ハーモニー・メディエーター傾向")).toBeDefined();
    expect(screen.getByText("クリエイティブ・ソロ傾向")).toBeDefined();
    expect(container.querySelectorAll(".lp-carousel-card")).toHaveLength(4);
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  it("JavaScriptのタイマーでスクロール位置を更新しない", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<DiagnosisTypesCarousel />);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
