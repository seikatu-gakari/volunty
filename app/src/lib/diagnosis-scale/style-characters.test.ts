import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVITY_STYLE_TYPES } from "@/lib/diagnosis-scale/style-types";
import { findStyleCharacter, STYLE_CHARACTERS } from "@/lib/diagnosis-scale/style-characters";

const manifest: Array<{ id: string; filename: string; width: number; height: number; bytes: number; sha256: string }> = JSON.parse(
  readFileSync(join(process.cwd(), "public/images/diagnosis/characters/manifest.json"), "utf8"),
);

describe("活動スタイルの表示用キャラクター", () => {
  it("既存の10タイプを漏れ・重複なくカバーする", () => {
    expect(Object.keys(STYLE_CHARACTERS).sort()).toEqual(ACTIVITY_STYLE_TYPES.map(({ id }) => id).sort());
    expect(new Set(Object.values(STYLE_CHARACTERS).map(({ imagePath }) => imagePath)).size).toBe(10);
    expect(Object.values(STYLE_CHARACTERS).map(({ name }) => name)).toEqual([
      "ひらめきキツネ", "よりそいクマ", "つくりてネコ", "ていねいフクロウ", "えがおイルカ",
      "だんどりビーバー", "つなぎてカワウソ", "ぼうけんツバメ", "みまもりイヌ", "いろどりシカ",
    ]);
  });

  it.each(ACTIVITY_STYLE_TYPES)("$id に配信できるPNGがある", ({ id }) => {
    const character = findStyleCharacter(id)!;
    expect(character.strength.length).toBeGreaterThan(0);
    const bytes = readFileSync(join(process.cwd(), "public", character.imagePath));
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const asset = manifest.find((entry) => entry.id === id)!;
    expect(asset.filename).toBe(`${id}.png`);
    expect(bytes.readUInt32BE(16)).toBe(asset.width);
    expect(bytes.readUInt32BE(20)).toBe(asset.height);
    expect(asset.width).toBe(512);
    expect(asset.height).toBe(512);
    expect(bytes[25]).toBe(6); // 透過情報を持つRGBA
    expect(bytes.length).toBe(asset.bytes);
    expect(bytes.length).toBeLessThan(200 * 1024);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
  });

  it("画像マニフェストも10タイプを過不足なくカバーする", () => {
    expect(manifest.map(({ id }) => id).sort()).toEqual(Object.keys(STYLE_CHARACTERS).sort());
  });

  it.each(["unknown", "toString", "__proto__"])("未知のID %s は画像を表示しない", (id) => {
    expect(findStyleCharacter(id)).toBeUndefined();
  });
});
