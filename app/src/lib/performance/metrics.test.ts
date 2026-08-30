/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

type MetricsModule = {
  calculatePercentiles: (samples: number[]) => {
    p50: number;
    p75: number;
    p95: number;
  };
};

const performanceModules = import.meta.glob<MetricsModule>("./metrics.ts");

describe("performance metrics", () => {
  it("nearest-rank方式でp50・p75・p95を返す", () => {
    const loadMetrics = performanceModules["./metrics.ts"];

    expect(loadMetrics).toBeDefined();
    if (!loadMetrics) {
      return;
    }

    return loadMetrics().then((metricsModule: MetricsModule) => {
      expect(metricsModule).not.toBeNull();
      expect(metricsModule.calculatePercentiles([400, 100, 300, 200])).toEqual({
        p50: 200,
        p75: 300,
        p95: 400,
      });
    });
  });
});
