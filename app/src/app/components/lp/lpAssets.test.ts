import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lpAssets } from "./lpAssets";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff]/;

function getPublicAssetPath(src: string) {
  return path.join(process.cwd(), "public", src);
}

describe("lpAssets", () => {
  it("LPで使う画像を /lp/mobile/ 配下へ一意に定義する", () => {
    const assets = Object.values(lpAssets);
    const sources = assets.map((asset) => asset.src);

    expect(assets).toHaveLength(13);
    expect(lpAssets).not.toHaveProperty("brandMark");
    expect(new Set(sources).size).toBe(sources.length);

    for (const asset of assets) {
      expect(asset.src.startsWith("/lp/mobile/")).toBe(true);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(typeof asset.alt).toBe("string");
    }
  });

  it("publicに実在するPNGの実寸をmetadataと一致させる", () => {
    for (const asset of Object.values(lpAssets)) {
      const assetPath = getPublicAssetPath(asset.src);

      expect(existsSync(assetPath)).toBe(true);
      const png = readFileSync(assetPath);

      expect(png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
      expect(png.toString("ascii", 12, 16)).toBe("IHDR");
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
    }
  });

  it("内容画像には日本語altを持たせ、装飾画像は空altにする", () => {
    const { orbitMotif, ...contentImages } = lpAssets;

    for (const asset of Object.values(contentImages)) {
      expect(asset.alt).toMatch(JAPANESE_TEXT);
    }

    // 軌道モチーフは情報を持たない純粋な装飾画像。
    expect(orbitMotif.alt).toBe("");
  });
});
