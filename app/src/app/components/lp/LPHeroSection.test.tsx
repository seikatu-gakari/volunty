import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LPHeroSection } from "@/app/components/lp/LPHeroSection";

describe("LPHeroSection", () => {
  it("準備中であることを伝え、開始通知へ案内する", () => {
    render(<LPHeroSection />);

    expect(screen.getByText(/ただいまサービス公開に向けて準備中です/)).toBeDefined();
    expect(screen.getByRole("link", { name: "無料で開始通知を受け取る" }).getAttribute("href")).toBe("#waitlist");
    expect(screen.getByRole("link", { name: "活動例を見る" }).getAttribute("href")).toBe("#styles");
    expect(screen.getByText("事前登録は無料")).toBeDefined();
    expect(screen.getByText("メールだけで登録")).toBeDefined();
  });
});
