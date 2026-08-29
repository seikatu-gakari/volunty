import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

const videoAnnotations = {
  actions: {
    duration: 500,
    position: "top-right" as const,
    fontSize: 14,
  },
  test: {
    level: "step" as const,
    position: "top-left" as const,
    fontSize: 12,
  },
};

export default defineConfig({
  ...baseConfig,
  outputDir: process.env.PR_DEMO_TEST_OUTPUT_DIR ?? "test-results/pr-demo",
  reporter: [["list"]],
  use: {
    ...baseConfig.use,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: { video: "off", trace: "off", screenshot: "off" },
    },
    {
      name: "demo-desktop",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        video: {
          mode: "on",
          size: { width: 1280, height: 720 },
          show: videoAnnotations,
        },
      },
    },
    {
      name: "demo-mobile",
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        video: {
          mode: "on",
          size: { width: 390, height: 844 },
          show: videoAnnotations,
        },
      },
    },
  ],
});
