import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrialDiagnosisClient } from "@/app/diagnosis/trial/components/TrialDiagnosisClient";
import { findClosestStyleType } from "@/lib/diagnosis-scale/style-types";
import { findStyleCharacter } from "@/lib/diagnosis-scale/style-characters";

afterEach(cleanup);

describe("お試し診断のキャラクター表示", () => {
  it("15問の回答・戻る・結果・再診断を通して正しいキャラクターを表示する", () => {
    const { container } = render(<TrialDiagnosisClient />);
    expect(screen.queryByText("あなたに近い活動スタイル（参考）")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "どちらともいえない" }));
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(screen.getByText("質問 1 / 15")).toBeDefined();
    for (let i = 1; i <= 15; i++) {
      expect(screen.getByText(`質問 ${i} / 15`)).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "どちらともいえない" }));
    }
    const style = findClosestStyleType({ extraversion: 50, agreeableness: 50, conscientiousness: 50, emotionalStability: 50, intellect: 50 }).type;
    expect(screen.getByRole("heading", { name: findStyleCharacter(style.id)!.name })).toBeDefined();
    expect(screen.getByText(style.name)).toBeDefined();
    expect(screen.getByText(style.description)).toBeDefined();
    expect(screen.getByText(/簡易15問のお試し結果です/)).toBeDefined();
    expect(screen.getByRole("link", { name: "登録して結果を活用する" }).getAttribute("href")).toBe("/onboarding/role");
    expect(container.querySelector("img")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(screen.getByText("質問 1 / 15")).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });
});
