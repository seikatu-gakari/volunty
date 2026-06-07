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

  it("連続アニメーション用にカード列を複製して表示する", () => {
    const { container } = render(<DiagnosisTypesCarousel />);

    const carousel = screen.getByLabelText("診断タイプの連続カルーセル");
    const track = carousel.querySelector(".lp-carousel-track");
    const cardGroups = container.querySelectorAll("[data-carousel-card-group]");

    expect(track).not.toBeNull();
    expect(cardGroups).toHaveLength(2);
    expect(cardGroups[1].getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll(".lp-carousel-card")).toHaveLength(16);
  });

  it("JavaScriptのタイマーでスクロール位置を更新しない", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<DiagnosisTypesCarousel />);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
