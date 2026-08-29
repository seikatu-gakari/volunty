import { rmSync } from "node:fs";

import { AUTH_STATE_DIRECTORY } from "../test-support/playwright-auth-state";

export default function globalTeardown(): void {
  rmSync(AUTH_STATE_DIRECTORY, { recursive: true, force: true });
}
