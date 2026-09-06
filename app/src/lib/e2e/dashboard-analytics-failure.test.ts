import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { shouldFailDashboardAnalyticsForE2E } from "./dashboard-analytics-failure";

describe("ダッシュボード分析のE2E失敗注入ガード", () => {
  it("本番環境ではheaderとflagが揃っても無効", () => {
    expect(
      shouldFailDashboardAnalyticsForE2E(
        new Headers({ "x-e2e-dashboard-analytics-failure": "true" }),
        { NODE_ENV: "production", E2E_AUTH_ENABLED: "true" },
      ),
    ).toBe(false);
  });

  it("E2E flagが無効なら非本番でも無効", () => {
    expect(
      shouldFailDashboardAnalyticsForE2E(
        new Headers({ "x-e2e-dashboard-analytics-failure": "true" }),
        { NODE_ENV: "test", E2E_AUTH_ENABLED: "false" },
      ),
    ).toBe(false);
  });

  it("専用headerがなければ無効", () => {
    expect(
      shouldFailDashboardAnalyticsForE2E(new Headers(), {
        NODE_ENV: "test",
        E2E_AUTH_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("非本番・E2E flag・専用headerが揃った場合だけ有効", () => {
    expect(
      shouldFailDashboardAnalyticsForE2E(
        new Headers({ "x-e2e-dashboard-analytics-failure": "true" }),
        { NODE_ENV: "test", E2E_AUTH_ENABLED: "true" },
      ),
    ).toBe(true);
  });
});
