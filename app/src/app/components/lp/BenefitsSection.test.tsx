import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BenefitsSection } from "./BenefitsSection";

describe("BenefitsSection", () => {
  it("3つの参加価値を写真付きで表示する", () => {
    render(<BenefitsSection />);

    expect(screen.getByText("気楽な雰囲気で交流")).toBeDefined();
    expect(screen.getByText("小さな承認体験")).toBeDefined();
    expect(screen.getByText("目に見える成果")).toBeDefined();
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("サービス名をカタカナで表示する", () => {
    render(<BenefitsSection />);

    expect(screen.getByText(/ボランティーのボランティア/)).toBeDefined();
    expect(screen.queryByText(/Volunty/)).toBeNull();
  });
});
