/// <reference types="vite/client" />

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type DiagnosisDelayModule = {
  shouldDelayDiagnosisForE2E: (
    requestHeaders: Headers,
    environment: NodeJS.ProcessEnv,
  ) => boolean;
};

const e2eModules = import.meta.glob<DiagnosisDelayModule>("./diagnosis-delay.ts");

describe("診断画面のE2E限定遅延", () => {
  it("本番環境では有効化headerとE2E flagがあっても遅延しない", async () => {
    const loadDelay = e2eModules["./diagnosis-delay.ts"];

    expect(loadDelay).toBeDefined();
    if (!loadDelay) {
      return;
    }

    const { shouldDelayDiagnosisForE2E } = await loadDelay();
    expect(
      shouldDelayDiagnosisForE2E(
        new Headers({ "x-e2e-delay-diagnosis": "true" }),
        { NODE_ENV: "production", E2E_AUTH_ENABLED: "true" },
      ),
    ).toBe(false);
  });

  it("非本番環境でE2E flagと専用headerが揃う場合だけ遅延する", async () => {
    const loadDelay = e2eModules["./diagnosis-delay.ts"];

    expect(loadDelay).toBeDefined();
    if (!loadDelay) {
      return;
    }

    const { shouldDelayDiagnosisForE2E } = await loadDelay();
    expect(
      shouldDelayDiagnosisForE2E(
        new Headers({ "x-e2e-delay-diagnosis": "true" }),
        { NODE_ENV: "test", E2E_AUTH_ENABLED: "true" },
      ),
    ).toBe(true);
  });
});
