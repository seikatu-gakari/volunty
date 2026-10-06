import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreSection } from "@/app/diagnosis/components/ScoreSection";
import { BIG5_DOMAIN_DESCRIPTIONS } from "@/lib/diagnosis-scale/types";

afterEach(cleanup);

describe("5つの連続スコア", () => {
  it("実測値の小数・両方向の説明・中間域を表示し、順位とは表現しない", () => {
    render(<ScoreSection scores={{ extraversion: 83.3, agreeableness: 16.7, conscientiousness: 50, emotionalStability: 0, intellect: 100 }} />);
    expect(screen.getAllByRole("meter")).toHaveLength(5);
    expect(screen.getByRole("meter", { name: "外向性" }).getAttribute("aria-valuenow")).toBe("83.3");
    expect(screen.getByText("83.3")).toBeDefined();
    expect(screen.getByText("16.7")).toBeDefined();
    expect(screen.getByText(BIG5_DOMAIN_DESCRIPTIONS.extraversion.high)).toBeDefined();
    expect(screen.getByText(BIG5_DOMAIN_DESCRIPTIONS.agreeableness.low)).toBeDefined();
    expect(screen.getByText(BIG5_DOMAIN_DESCRIPTIONS.emotionalStability.low)).toBeDefined();
    expect(screen.getByText(/どちらの方向も際立たない中間域/)).toBeDefined();
    expect(screen.getByText(/「上位◯%」を表すものではありません/)).toBeDefined();
  });
  it("暫定分類境界の65と35では方向を説明し、その内側は中間域とする", () => {
    render(<ScoreSection scores={{ extraversion: 65, agreeableness: 35, conscientiousness: 64.9, emotionalStability: 35.1, intellect: 50 }} />);
    expect(screen.getByText(BIG5_DOMAIN_DESCRIPTIONS.extraversion.high)).toBeDefined();
    expect(screen.getByText(BIG5_DOMAIN_DESCRIPTIONS.agreeableness.low)).toBeDefined();
    expect(screen.getAllByText(/どちらの方向も際立たない中間域/)).toHaveLength(3);
  });

});
