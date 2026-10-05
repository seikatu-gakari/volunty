import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrialDiagnosisClient } from "@/app/diagnosis/trial/components/TrialDiagnosisClient";
import { classifyActivityStyle } from "@/lib/diagnosis-scale/activity-styles";
import { getItemsInDisplayOrder, getScaleDefinition } from "@/lib/diagnosis-scale/scale";
import { BIG5_DOMAINS, BIG5_DOMAIN_LABELS } from "@/lib/diagnosis-scale/types";

afterEach(cleanup);

describe("お試し診断の活動スタイル表示", () => {
  it("15問の回答・戻る・中立結果・再診断を通して実測スコアを表示する", () => {
    const { container } = render(<TrialDiagnosisClient />);
    expect(screen.queryByText("あなたに近い活動スタイル（参考）")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "どちらともいえない" }));
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(screen.getByText("質問 1 / 15")).toBeDefined();
    for (let i = 1; i <= 15; i++) {
      expect(screen.getByText(`質問 ${i} / 15`)).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "どちらともいえない" }));
    }
    const style = classifyActivityStyle({ extraversion: 50, agreeableness: 50, conscientiousness: 50, emotionalStability: 50, intellect: 50 });
    expect(screen.getByRole("heading", { name: style.name })).toBeDefined();
    expect(screen.getByText(style.description)).toBeDefined();
    for (const domain of BIG5_DOMAINS) {
      expect(screen.getByRole("meter", { name: BIG5_DOMAIN_LABELS[domain] }).getAttribute("aria-valuenow")).toBe("50");
    }
    expect(screen.getByText(/簡易15問のお試し結果です/)).toBeDefined();
    expect(screen.getByText(/他の人の中での順位/)).toBeDefined();
    expect(screen.getByText(/特に15問版は1問の影響が大きい/)).toBeDefined();
    expect(screen.getByRole("link", { name: "登録して結果を活用する" }).getAttribute("href")).toBe("/onboarding/role");
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(screen.getByText("質問 1 / 15")).toBeDefined();
    expect(screen.queryByRole("meter")).toBeNull();

    // 再回答の結果は前回の中立結果ではなく、新しい回答から求める。
    for (const item of getItemsInDisplayOrder(getScaleDefinition("brief"))) {
      fireEvent.click(screen.getByRole("button", { name: item.keyed === "+" ? "非常に当てはまる" : "全く当てはまらない" }));
    }
    const mixed = classifyActivityStyle({ extraversion: 100, agreeableness: 100, conscientiousness: 100, emotionalStability: 100, intellect: 100 });
    expect(screen.getByRole("heading", { name: mixed.name })).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(container.querySelectorAll("img")).toHaveLength(5);
    expect(screen.getAllByRole("meter").every((meter) => meter.getAttribute("aria-valuenow") === "100")).toBe(true);
  });
});
