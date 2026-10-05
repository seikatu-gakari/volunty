import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQSection } from "./FAQSection";

describe("FAQSection", () => {
  it("最初の質問を初期表示し、質問を開閉できる", () => {
    render(<FAQSection />);

    const first = screen.getByRole("button", { name: "今すぐサービスを使えますか？" });
    const second = screen.getByRole("button", {
      name: "事前登録は無料ですか？",
    });

    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(second.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(second);

    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/メールアドレスだけで開始通知に登録/)).toBeDefined();

    fireEvent.click(second);
    expect(second.getAttribute("aria-expanded")).toBe("false");
  });
});
