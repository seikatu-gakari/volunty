export function createPlaywrightWebServer({ isCI }: { isCI: boolean }) {
  return {
    command: isCI ? "npm run dev" : "npm run dev -- --webpack",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  } as const;
}

export const playwrightWebServer = createPlaywrightWebServer({
  isCI: Boolean(process.env.CI),
});
