import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageSection } from "./UsageSection";

describe("UsageSection", () => {
  it("3ステップ（チェック・マッチング・参加）を表示する", () => {
    render(<UsageSection />);

    expect(screen.getByText("性格傾向チェック・登録")).toBeDefined();
    expect(screen.getByText("マッチング")).toBeDefined();
    expect(screen.getByText("参加・つながり")).toBeDefined();
  });

  it("ページ内リンク用の usage アンカーを持つ", () => {
    const { container } = render(<UsageSection />);

    expect(container.querySelector("section#usage")).not.toBeNull();
  });
});
