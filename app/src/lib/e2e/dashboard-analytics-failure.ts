import "server-only";

const DASHBOARD_ANALYTICS_FAILURE_HEADER =
  "x-e2e-dashboard-analytics-failure";

export function shouldFailDashboardAnalyticsForE2E(
  requestHeaders: Headers,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    environment.NODE_ENV !== "production" &&
    environment.E2E_AUTH_ENABLED === "true" &&
    requestHeaders.get(DASHBOARD_ANALYTICS_FAILURE_HEADER) === "true"
  );
}
