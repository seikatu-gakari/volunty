import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const FILE_NAME_PATTERN = /^[a-z0-9-]+\.json$/;
const appDirectory = resolve(process.cwd());

export function buildAuthStateDirectory(
  projectRoot: string,
  tempRoot: string = tmpdir(),
): string {
  const normalizedRoot = resolve(projectRoot);
  const suffix = createHash("sha256").update(normalizedRoot).digest("hex").slice(0, 16);
  return join(resolve(tempRoot), `volunty-playwright-auth-${suffix}`);
}

export function buildAuthStatePath(fileName: string, directory: string): string {
  if (!FILE_NAME_PATTERN.test(fileName) || !isAbsolute(directory)) {
    throw new Error("Playwright auth stateのdirectoryまたはfile名が不正です");
  }
  return join(directory, fileName);
}

export const AUTH_STATE_DIRECTORY = buildAuthStateDirectory(appDirectory);

export function authStatePath(fileName: string): string {
  return buildAuthStatePath(fileName, AUTH_STATE_DIRECTORY);
}
