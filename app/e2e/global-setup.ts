import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { AUTH_STATE_DIRECTORY } from "../test-support/playwright-auth-state";

const appDirectory = fileURLToPath(new URL("..", import.meta.url));

export default function globalSetup(): void {
  rmSync(AUTH_STATE_DIRECTORY, { recursive: true, force: true });
  mkdirSync(AUTH_STATE_DIRECTORY, { recursive: true, mode: 0o700 });

  // server-only を含むseedをPlaywrightから直接importせず、別プロセスで実行する。
  execFileSync("npm", ["run", "seed:e2e"], {
    cwd: appDirectory,
    stdio: "inherit",
  });
}
