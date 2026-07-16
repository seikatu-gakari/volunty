import { describe, expect, it } from "vitest";
import { lpAssets } from "./lpAssets";

describe("lpAssets", () => {
  it("LPで使う画像を /lp/mobile/ 配下へ一意に定義する", () => {
    const assets = Object.values(lpAssets);
    const sources = assets.map((asset) => asset.src);

    expect(assets.length).toBeGreaterThanOrEqual(15);
    expect(new Set(sources).size).toBe(sources.length);

    for (const asset of assets) {
      expect(asset.src.startsWith("/lp/mobile/")).toBe(true);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(typeof asset.alt).toBe("string");
    }
  });

  it("内容を伝える写真には日本語の代替テキストを持たせる", () => {
    expect(lpAssets.heroCleanup.alt).toContain("ボランティア");
    expect(lpAssets.painWelcome.alt).toContain("参加");
    expect(lpAssets.benefitFestival.alt).toContain("地域");
    expect(lpAssets.brandMark.alt).toBe("");
    expect(lpAssets.orbitMotif.alt).toBe("");
  });
});
