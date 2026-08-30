import "server-only";

const E2E_DELAY_HEADER = "x-e2e-delay-diagnosis";
const E2E_DELAY_MS = 1_000;

export function shouldDelayDiagnosisForE2E(
  requestHeaders: Headers,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return (
    environment.NODE_ENV !== "production" &&
    environment.E2E_AUTH_ENABLED === "true" &&
    requestHeaders.get(E2E_DELAY_HEADER) === "true"
  );
}

/** E2Eのloading boundary検証時だけ診断ページの完了を遅らせる。 */
export async function delayDiagnosisForE2E(requestHeaders: Headers) {
  if (!shouldDelayDiagnosisForE2E(requestHeaders)) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, E2E_DELAY_MS);
  });
}
