import { describe, expect, it } from "vitest";

import { playwrightWebServer } from "./playwright.web-server";

describe("Playwright web server", () => {
  it("E2Eを安定したwebpack modeで起動する", () => {
    expect(playwrightWebServer).toMatchObject({
      command: "npm run dev -- --webpack",
      url: "http://localhost:3000",
    });
  });
});
