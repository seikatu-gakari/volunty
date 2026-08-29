import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { collectChangedFiles } from "./evaluate-pr.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("baseとheadの間で追加・変更・rename・削除されたfileを列挙する", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "volunty-pr-demo-diff-"));
  git(cwd, ["init", "-q"]);
  git(cwd, ["config", "user.name", "PR Demo Test"]);
  git(cwd, ["config", "user.email", "pr-demo@example.com"]);

  await writeFile(join(cwd, "before.txt"), "before\n");
  await writeFile(join(cwd, "deleted.txt"), "delete me\n");
  git(cwd, ["add", "before.txt", "deleted.txt"]);
  git(cwd, ["commit", "-qm", "base"]);
  const baseSha = git(cwd, ["rev-parse", "HEAD"]);

  git(cwd, ["mv", "before.txt", "after.txt"]);
  git(cwd, ["rm", "deleted.txt"]);
  await writeFile(join(cwd, "new.txt"), "new\n");
  git(cwd, ["add", "after.txt", "new.txt"]);
  git(cwd, ["commit", "-qm", "head"]);
  const headSha = git(cwd, ["rev-parse", "HEAD"]);

  assert.deepEqual(collectChangedFiles(cwd, baseSha, headSha), [
    "after.txt",
    "before.txt",
    "deleted.txt",
    "new.txt",
  ]);
});

test("base branchだけで進んだ変更をPRの変更fileへ含めない", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "volunty-pr-demo-merge-base-"));
  git(cwd, ["init", "-q"]);
  git(cwd, ["config", "user.name", "PR Demo Test"]);
  git(cwd, ["config", "user.email", "pr-demo@example.com"]);

  await writeFile(join(cwd, "README.md"), "base\n");
  git(cwd, ["add", "README.md"]);
  git(cwd, ["commit", "-qm", "common base"]);
  const baseBranch = git(cwd, ["branch", "--show-current"]);

  git(cwd, ["switch", "-qc", "feature"]);
  await writeFile(join(cwd, "feature.md"), "feature\n");
  git(cwd, ["add", "feature.md"]);
  git(cwd, ["commit", "-qm", "feature change"]);
  const headSha = git(cwd, ["rev-parse", "HEAD"]);

  git(cwd, ["switch", "-q", baseBranch]);
  await mkdir(join(cwd, "app", "src", "app", "base-only"), { recursive: true });
  await writeFile(join(cwd, "app", "src", "app", "base-only", "page.tsx"), "base only\n");
  git(cwd, ["add", "app/src/app/base-only/page.tsx"]);
  git(cwd, ["commit", "-qm", "base-only UI change"]);
  const baseSha = git(cwd, ["rev-parse", "HEAD"]);

  assert.deepEqual(collectChangedFiles(cwd, baseSha, headSha), ["feature.md"]);
});

test("通常fileからsymlinkへのtype changeもPR変更fileへ含める", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "volunty-pr-demo-type-change-"));
  git(cwd, ["init", "-q"]);
  git(cwd, ["config", "user.name", "PR Demo Test"]);
  git(cwd, ["config", "user.email", "pr-demo@example.com"]);
  const uiPath = join(cwd, "page.tsx");
  await writeFile(uiPath, "export default function Page() {}\n");
  git(cwd, ["add", "page.tsx"]);
  git(cwd, ["commit", "-qm", "base"]);
  const baseSha = git(cwd, ["rev-parse", "HEAD"]);

  await unlink(uiPath);
  await symlink("elsewhere.tsx", uiPath);
  git(cwd, ["add", "page.tsx"]);
  git(cwd, ["commit", "-qm", "type change"]);
  const headSha = git(cwd, ["rev-parse", "HEAD"]);

  assert.deepEqual(collectChangedFiles(cwd, baseSha, headSha), ["page.tsx"]);
});
