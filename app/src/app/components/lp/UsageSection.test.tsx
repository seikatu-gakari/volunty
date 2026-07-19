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

  it("5つの性格傾向と参考情報である注記を表示する", () => {
    render(<UsageSection />);

    for (const label of ["外向性", "協調性", "誠実性", "情緒安定性", "知性・想像性"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(screen.getByText("結果は活動選びの参考情報です")).toBeDefined();
    expect(screen.getByText("サポーター・ケア傾向")).toBeDefined();
  });
});
