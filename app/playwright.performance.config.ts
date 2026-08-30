import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PERF_BASE_URL;
const storageState = process.env.PERF_STORAGE_STATE;

if (!baseURL || !storageState) {
  throw new Error(
    "PERF_BASE_URL と PERF_STORAGE_STATE を指定して性能計測を実行してください。",
  );
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.perf.spec.ts",
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    storageState,
    viewport: { width: 1440, height: 900 },
  },
});
