import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VoicesSection } from "./VoicesSection";

describe("VoicesSection", () => {
  it("参加者と団体の声カードを表示する", () => {
    render(<VoicesSection />);

    expect(screen.getByText(/はじめての参加/)).toBeDefined();
    expect(screen.getByText(/NPO法人/)).toBeDefined();
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("実際の声ではなくイメージ例であることを明記する", () => {
    render(<VoicesSection />);

    // 見出し下の説明と末尾の注記の両方でイメージ例であることを示す
    expect(screen.getAllByText(/イメージ例/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/実際のご利用者の声ではありません/),
    ).toBeDefined();
  });

  it("サービス名をカタカナで表示する", () => {
    render(<VoicesSection />);

    expect(screen.getByText(/ボランティーが目指す/)).toBeDefined();
    expect(screen.queryByText(/Volunty/)).toBeNull();
  });
});
