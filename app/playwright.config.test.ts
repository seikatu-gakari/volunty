import { describe, expect, it } from "vitest";

import { playwrightWebServerEnv } from "./playwright-web-server-env";

describe("playwright.config", () => {
  it("シェル未定義のE2E_AUTH_ENABLEDでNext.jsの.env.localを上書きしない", () => {
    expect(playwrightWebServerEnv({})).not.toHaveProperty("E2E_AUTH_ENABLED");
  });

  it("シェルで明示したE2E_AUTH_ENABLEDは開発サーバーへ渡す", () => {
    expect(
      playwrightWebServerEnv({ E2E_AUTH_ENABLED: "true" }),
    ).toMatchObject({ E2E_AUTH_ENABLED: "true" });
  });
});
