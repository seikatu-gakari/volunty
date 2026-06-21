import { describe, expect, it } from "vitest";
import { buildLineFriendContact } from "./contact";

describe("buildLineFriendContact", () => {
  it("有効な line.me の友だち追加URLをそのまま採用する", () => {
    const result = buildLineFriendContact({
      url: "https://line.me/R/ti/p/@volunty",
      id: "@volunty",
    });

    expect(result.addUrl).toBe("https://line.me/R/ti/p/@volunty");
    expect(result.displayId).toBe("@volunty");
  });

  it("有効な lin.ee の短縮URLを採用する", () => {
    const result = buildLineFriendContact({
      url: "https://lin.ee/abcd123",
      id: null,
    });

    expect(result.addUrl).toBe("https://lin.ee/abcd123");
    expect(result.displayId).toBeNull();
  });

  it("URLが無く @id があるとき line.me URL を生成する", () => {
    const result = buildLineFriendContact({ url: null, id: "@volunty" });

    expect(result.addUrl).toBe("https://line.me/R/ti/p/@volunty");
    expect(result.displayId).toBe("@volunty");
  });

  it("先頭に @ が無い id にも @ を補ってURLを生成する", () => {
    const result = buildLineFriendContact({ url: "", id: "volunty" });

    expect(result.addUrl).toBe("https://line.me/R/ti/p/@volunty");
    expect(result.displayId).toBe("volunty");
  });

  it("http や他ドメインのURLは却下し、idからのフォールバックも無ければ null", () => {
    const httpResult = buildLineFriendContact({
      url: "http://line.me/R/ti/p/@x",
      id: null,
    });
    expect(httpResult.addUrl).toBeNull();

    const otherDomain = buildLineFriendContact({
      url: "https://evil.example.com/@x",
      id: null,
    });
    expect(otherDomain.addUrl).toBeNull();
  });

  it("不正な文字を含む id は URL 生成に使わない", () => {
    const result = buildLineFriendContact({ url: null, id: "  invalid id!! " });

    expect(result.addUrl).toBeNull();
    expect(result.displayId).toBe("invalid id!!");
  });

  it("URL も id も無効なら addUrl / displayId とも null", () => {
    const result = buildLineFriendContact({ url: null, id: null });

    expect(result.addUrl).toBeNull();
    expect(result.displayId).toBeNull();
  });
});
