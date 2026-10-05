import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityStyleHero } from "@/app/diagnosis/components/ActivityStyleHero";
import { ACTIVITY_STYLE_TYPES } from "@/lib/diagnosis-scale/style-types";
import { findStyleCharacter } from "@/lib/diagnosis-scale/style-characters";

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
