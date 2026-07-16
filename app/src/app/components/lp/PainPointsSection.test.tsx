import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PainPointsSection } from "./PainPointsSection";

vi.mock("next/image", () => ({
  default: ({ alt, src, className }: { alt: string; src: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} className={className} />
  ),
}));

describe("PainPointsSection", () => {
  it("初参加者の写真と3つの課題解決を表示する", () => {
    render(<PainPointsSection />);

    expect(
      screen.getByRole("img", { name: "初参加の人を笑顔で迎えるボランティアスタッフ" }),
    ).toBeDefined();
    expect(screen.getByText("性格傾向と興味から活動を提案")).toBeDefined();
    expect(screen.getByText("応募までの流れをまとめて表示")).toBeDefined();
    expect(screen.getByText("事前メッセージで団体に相談")).toBeDefined();
    expect(screen.getAllByTestId("pain-solution")).toHaveLength(3);
  });

  it("カタカナのサービス名を使用する", () => {
    render(<PainPointsSection />);

    expect(screen.getByText(/ボランティーはひとつずつ解消/)).toBeDefined();
    expect(screen.queryByText(/Volunty/)).toBeNull();
  });
});
