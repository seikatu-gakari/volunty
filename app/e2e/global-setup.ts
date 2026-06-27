import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appDirectory = fileURLToPath(new URL("..", import.meta.url));

export default function globalSetup(): void {
  mkdirSync(new URL("../playwright/.auth/", import.meta.url), {
    recursive: true,
  });

  // server-only を含むseedをPlaywrightから直接importせず、別プロセスで実行する。
  execFileSync("npm", ["run", "seed:e2e"], {
    cwd: appDirectory,
    stdio: "inherit",
  });
}
