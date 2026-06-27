import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];

function read(relativePath) {
  const path = new URL(relativePath, new URL(`file://${root}/`));
  if (!existsSync(path)) {
    failures.push(`${relativePath}: ファイルが存在しません`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function requireText(relativePath, text, description) {
  const content = read(relativePath);
  if (!content.includes(text)) {
    failures.push(`${relativePath}: ${description}`);
  }
}

const skillPath =
  ".agent-shared/skills/volunty-test-completion-gate/SKILL.md";

requireText(
  "AGENTS.md",
  ".agent-shared/skills/volunty-test-completion-gate/SKILL.md",
  "Skillルーターにcompletion gateがありません"
);
requireText(
  "AGENTS.md",
  "実装・修正・リファクタリング完了前",
  "共通開発ルールにcompletion gateの入口がありません"
);

for (const [text, description] of [
  ["name: volunty-test-completion-gate", "skill名が不正です"],
  ["## 変更分類", "変更分類がありません"],
  ["| 変更 | UT | E2E |", "UT/E2E判定表がありません"],
  ["npm test", "UT全体検証コマンドがありません"],
  ["make e2e", "E2E検証コマンドがありません"],
  ["適用外理由", "テスト適用外の報告ルールがありません"],
  ["完了を宣言しない", "未検証時の完了禁止ルールがありません"],
]) {
  requireText(skillPath, text, description);
}

for (const [path, text, description] of [
  [
    ".agent-shared/skills/volunty-dev-commands/SKILL.md",
    "## E2E",
    "E2Eコマンド節がありません",
  ],
  [
    ".agent-shared/skills/volunty-dev-commands/SKILL.md",
    "make e2e-ui",
    "E2E UIコマンドがありません",
  ],
  [
    ".agent-shared/skills/volunty-dev-commands/SKILL.md",
    "make e2e-report",
    "E2Eレポートコマンドがありません",
  ],
  [
    ".agent-shared/skills/volunty-ai-development-guidelines/SKILL.md",
    "volunty-test-completion-gate",
    "AI開発ガイドラインからcompletion gateを参照していません",
  ],
  [
    ".agent-shared/skills/git-finish-worktree-pr/SKILL.md",
    "volunty-test-completion-gate",
    "PR完了skillからcompletion gateを参照していません",
  ],
]) {
  requireText(path, text, description);
}

if (failures.length > 0) {
  console.error("Test completion gate verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Test completion gate verification passed");
