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

    expect(screen.getByText(/ボランティはひとつずつ解消/)).toBeDefined();
    expect(screen.queryByText(/Volunty/)).toBeNull();
  });

  it("出典注記を本文色で読みやすく表示する", () => {
    render(<PainPointsSection />);

    const note = screen.getByText(/東京都生活文化スポーツ局/);
    expect(note.className).toContain("text-text-body");
    expect(note.className).not.toContain("text-text-body/70");
    expect(note.className).not.toContain("opacity-70");
  });
});
