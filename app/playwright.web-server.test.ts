import { describe, expect, it } from "vitest";

import { createPlaywrightWebServer } from "./playwright.web-server";

describe("Playwright web server", () => {
  it("ローカルE2Eを安定したwebpack modeで起動する", () => {
    expect(createPlaywrightWebServer({ isCI: false })).toMatchObject({
      command: "npm run dev -- --webpack",
      url: "http://localhost:3000",
    });
  });

  it("CIではLinux runnerで実績のある既定dev serverを使う", () => {
    expect(createPlaywrightWebServer({ isCI: true })).toMatchObject({
      command: "npm run dev",
      reuseExistingServer: false,
    });
  });
});
