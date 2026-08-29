export const playwrightWebServer = {
  command: "npm run dev -- --webpack",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
} as const;
