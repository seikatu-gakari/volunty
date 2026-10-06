import { findDirectionCharacter } from "@/lib/diagnosis-scale/style-characters";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ACTIVITY_STYLE_DIRECTIONS } from "@/lib/diagnosis-scale/activity-styles";
import { DiagnosisTypesGrid } from "./DiagnosisTypesGrid";

describe("DiagnosisTypesGrid", () => {
  it("5つの特性の両方向を共通定義から10件表示する", () => {
    render(<DiagnosisTypesGrid />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(10);
    for (const direction of ACTIVITY_STYLE_DIRECTIONS) {
      expect(screen.getByRole("heading", { name: findDirectionCharacter(direction.id)!.name })).toBeDefined();
      expect(screen.getByText(direction.description)).toBeDefined();
    }
    const images = document.querySelectorAll("#types img");
    expect(images).toHaveLength(10);
    expect(Array.from(images).every((image) => image.getAttribute("alt") === "")).toBe(true);
    expect(screen.queryByText("活動例")).toBeNull();
  });

  it("補助ラベルの限界と中立・混合の結果があることを説明する", () => {
    render(<DiagnosisTypesGrid />);

    expect(screen.getByText(/活動スタイルの補助ラベル/)).toBeDefined();
    expect(screen.getByText(/科学的に確立された10類型ではなく/)).toBeDefined();
    expect(screen.getByText(/活動への適性や応募条件を決めるものでもありません/)).toBeDefined();
    expect(screen.getByText(/中央付近（中立）や複数の方向（混合）/)).toBeDefined();
    expect(screen.queryByText(/イノベーター・リーダー|パーフェクショニスト・アナリスト/)).toBeNull();
  });
});
