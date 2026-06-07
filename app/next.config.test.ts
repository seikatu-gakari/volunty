import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

interface NextConfigWithTurbopackRoot {
  turbopack?: {
    root?: string;
  };
}

describe("next.config", () => {
  it("Turbopack の project root を app ディレクトリに固定する", () => {
    const appRoot = dirname(fileURLToPath(import.meta.url));

    expect((nextConfig as NextConfigWithTurbopackRoot).turbopack?.root).toBe(appRoot);
  });
});
