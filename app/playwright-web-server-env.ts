export function playwrightWebServerEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const webServerEnv: Record<string, string> = {
    ACCOUNT_DELETION_ENABLED: "true",
  };

  if (env.E2E_AUTH_ENABLED !== undefined) {
    webServerEnv.E2E_AUTH_ENABLED = env.E2E_AUTH_ENABLED;
  }

  return webServerEnv;
}
