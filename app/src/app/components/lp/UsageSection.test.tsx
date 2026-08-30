import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageSection } from "./UsageSection";

describe("UsageSection", () => {
  it("見出し・説明と3ステップ（チェック・マッチング・参加）を表示する", () => {
    render(<UsageSection />);

    expect(screen.getByText("HOW IT WORKS")).toBeDefined();
    expect(screen.getByRole("heading", { name: "はじめるのは、かんたん3ステップ。" })).toBeDefined();
    expect(
      screen.getByText("自分を知ることから、活動への参加まで。迷わず進める体験をひとつにつなぎました。"),
    ).toBeDefined();
    expect(screen.getByText("STEP 01")).toBeDefined();
    expect(screen.getByText("STEP 02")).toBeDefined();
    expect(screen.getByText("STEP 03")).toBeDefined();
    expect(screen.getByText("性格傾向チェック・登録")).toBeDefined();
    expect(screen.getByText("マッチング")).toBeDefined();
    expect(screen.getByText("参加・つながり")).toBeDefined();
  });

  it("ページ内リンク用の usage アンカーを持つ", () => {
    const { container } = render(<UsageSection />);

    const section = container.querySelector("section#usage");
    expect(section).not.toBeNull();
    expect(section?.className).toContain("bg-pop-teal-soft");
    expect(section?.className).toContain("py-20");
    expect(section?.className).toContain("sm:py-24");
    expect(section?.querySelector(".grid.gap-6.lg\\:grid-cols-3")).not.toBeNull();
  });

  it("診断結果プレビューを表示しない", () => {
    render(<UsageSection />);

    for (const text of [
      "BIG FIVE",
      "5つの性格傾向をわかりやすく",
      "外向性",
      "協調性",
      "誠実性",
      "情緒安定性",
      "知性・想像性",
      "結果は活動選びの参考情報です",
      "YOUR STYLE",
      "サポーター・ケア傾向",
      "相手の気持ちを受け止め、安心できる場をつくる力が活きるスタイルです。",
      "見守り・傾聴",
      "受付サポート",
      "地域の居場所づくり",
    ]) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });
});
