import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPSectionHeading } from "./LPSectionHeading";

describe("LPSectionHeading", () => {
  it("eyebrow・見出し・説明文を表示する", () => {
    render(
      <LPSectionHeading
        eyebrow="使い方"
        title="はじめるのは、かんたん3ステップ。"
        description="登録から参加まで、最短でその日のうちに。"
      />,
    );

    expect(screen.getByText("使い方")).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "はじめるのは、かんたん3ステップ。" }),
    ).toBeDefined();
    expect(
      screen.getByText("登録から参加まで、最短でその日のうちに。"),
    ).toBeDefined();
  });

  it("説明文を省略できる", () => {
    const { container } = render(
      <LPSectionHeading eyebrow="FAQ" title="よくある質問" />,
    );

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});
