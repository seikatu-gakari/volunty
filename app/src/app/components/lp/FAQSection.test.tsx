import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQSection } from "./FAQSection";

describe("FAQSection", () => {
  it("最初の質問を初期表示し、質問を開閉できる", () => {
    render(<FAQSection />);

    const first = screen.getByRole("button", { name: "診断や登録は無料ですか？" });
    const second = screen.getByRole("button", {
      name: "診断はどのくらい時間がかかりますか？",
    });

    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(second.getAttribute("aria-expanded")).toBe("false");
    const firstQuestionLabel = first.querySelector("span > span");
    expect(firstQuestionLabel).not.toBeNull();
    expect(firstQuestionLabel?.className).toContain("bg-pop-coral-soft");
    expect(firstQuestionLabel?.className).toContain("text-text-dark");

    fireEvent.click(second);

    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/簡易診断（15問・約2分）/)).toBeDefined();
  });
});
