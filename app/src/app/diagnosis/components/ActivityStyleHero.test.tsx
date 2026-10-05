import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityStyleHero } from "@/app/diagnosis/components/ActivityStyleHero";
import { ACTIVITY_STYLE_TYPES } from "@/lib/diagnosis-scale/style-types";
import { ACTIVITY_STYLE_DIRECTIONS, classifyActivityStyle, findActivityStyleById } from "@/lib/diagnosis-scale/activity-styles";
import { findDirectionCharacter, findStyleCharacter } from "@/lib/diagnosis-scale/style-characters";

afterEach(cleanup);

describe("ActivityStyleHero", () => {
  it.each(ACTIVITY_STYLE_TYPES)("$id の名前・画像・参考表記を表示する", (styleType) => {
    const { container } = render(<ActivityStyleHero styleType={styleType} />);
    const character = findStyleCharacter(styleType.id)!;
    expect(screen.getByRole("heading", { name: character.name, level: 2 })).toBeDefined();
    expect(screen.getByText(character.strength)).toBeDefined();
    expect(screen.getByText(styleType.name)).toBeDefined();
    expect(screen.getByText(styleType.nameEn)).toBeDefined();
    expect(screen.getByText("あなたに近い活動スタイル（参考）")).toBeDefined();
    expect(screen.getByText(/性格を決めつけるものではなく/)).toBeDefined();
    const image = container.querySelector("img")!;
    expect(image.getAttribute("alt")).toBe("");
    expect(decodeURIComponent(image.getAttribute("src")!)).toContain(character.imagePath);
    expect(image.getAttribute("width")).toBe("256");
    expect(image.getAttribute("height")).toBe("256");
  });

  it("未知のタイプは従来のタイプ名を表示し、壊れた画像を出さない", () => {
    const styleType = { ...ACTIVITY_STYLE_TYPES[0], id: "unknown" as (typeof ACTIVITY_STYLE_TYPES)[number]["id"] };
    const { container } = render(<ActivityStyleHero styleType={styleType} />);
    expect(screen.getByRole("heading", { name: styleType.name })).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });
});


describe("新しい活動スタイルの方向表示", () => {
  it("中立結果を動物に置き換えず、分類の限界を表示する", () => {
    const style = classifyActivityStyle({ extraversion: 50, agreeableness: 50, conscientiousness: 50, emotionalStability: 50, intellect: 50 });
    const { container } = render(<ActivityStyleHero styleType={style} />);
    expect(screen.getByRole("heading", { name: style.name })).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(/科学的に確立した性格タイプではありません/)).toBeDefined();
    expect(screen.getByText(/分類の境界は暫定的/)).toBeDefined();
  });

  it.each([2, 3, 4, 5])("%i方向の混合結果を上位2方向に切り捨てず表示する", (count) => {
    const scores = { extraversion: 90, agreeableness: 90, conscientiousness: count >= 3 ? 90 : 50, emotionalStability: count >= 4 ? 90 : 50, intellect: count === 5 ? 90 : 50 };
    const style = classifyActivityStyle(scores);
    const { container } = render(<ActivityStyleHero styleType={style} />);
    expect(style.classificationKind).toBe("mixed");
    expect(screen.getAllByRole("listitem")).toHaveLength(count);
    for (const direction of style.directions ?? []) {
      expect(screen.getByText(direction.name)).toBeDefined();
    }
    expect(container.querySelectorAll("img")).toHaveLength(count);
    for (const direction of style.directions ?? []) {
      expect(screen.getByText(findDirectionCharacter(direction.id)!.name)).toBeDefined();
    }
    expect(new Set(Array.from(container.querySelectorAll("li")).map((item) => item.className)).size).toBe(1);
    expect(Array.from(container.querySelectorAll("img")).every((image) => image.getAttribute("alt") === "")).toBe(true);
  });
});


describe("単一方向の動物表示", () => {
  it.each(ACTIVITY_STYLE_DIRECTIONS)("$idを能力や旧タイプに置き換えず紹介する", (direction) => {
    const style = findActivityStyleById(`v2:${direction.id}`)!;
    const { container } = render(<ActivityStyleHero styleType={style} />);
    const character = findDirectionCharacter(direction.id)!;
    expect(screen.getByRole("heading", { name: character.name })).toBeDefined();
    expect(screen.getByText(direction.name)).toBeDefined();
    expect(screen.getByText(direction.description)).toBeDefined();
    expect(screen.getByText(/動物と性格に科学的な対応関係はなく/)).toBeDefined();
    expect(screen.getByText(/分類の境界は暫定的/)).toBeDefined();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
    expect(decodeURIComponent(container.querySelector("img")!.getAttribute("src")!)).toContain(character.imagePath);
  });
});
