import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildAuthStateDirectory,
  buildAuthStatePath,
} from "./test-support/playwright-auth-state";

describe("Playwright auth state path", () => {
  it("Next devのwatch対象外にあるworktree固有temp directoryを使う", () => {
    const tempRoot = resolve("/tmp");
    const first = buildAuthStateDirectory(resolve("/workspace/first/app"), tempRoot);
    const second = buildAuthStateDirectory(resolve("/workspace/second/app"), tempRoot);

    expect(first.startsWith(`${tempRoot}/volunty-playwright-auth-`)).toBe(true);
    expect(first).not.toBe(second);
  });

  it("許可したJSON file名だけをauth directory配下へ解決する", () => {
    expect(buildAuthStatePath("participant.json", "/tmp/auth")).toBe(
      "/tmp/auth/participant.json",
    );
    expect(() => buildAuthStatePath("../outside.json", "/tmp/auth")).toThrow(
      /file名/,
    );
  });
});
