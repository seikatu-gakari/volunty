import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("./sync-agent-mcp.mjs", import.meta.url));

test("updates only MCP sections in a Codex config from the shared server source", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "sync-agent-mcp-"));
  const sourcePath = path.join(tempDir, "servers.json");
  const outDir = path.join(tempDir, "generated");
  const codexConfigPath = path.join(tempDir, "config.toml");

  await mkdir(outDir, { recursive: true });
  await writeFile(
    sourcePath,
    `${JSON.stringify(
      {
        version: 1,
        servers: {
          serena: {
            type: "stdio",
            command: "uvx",
            args: [
              "--from",
              "git+https://github.com/oraios/serena",
              "serena",
              "start-mcp-server",
              "--context",
              "ide-assistant",
              "--open-web-dashboard",
              "false",
            ],
          },
          vercel: {
            type: "http",
            url: "https://mcp.vercel.com",
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    codexConfigPath,
    [
      'personality = "friendly"',
      "",
      "[mcp_servers]",
      "",
      "[mcp_servers.old]",
      'command = "old"',
      'args = ["stale"]',
      "",
      "[profiles.local]",
      'approval_policy = "never"',
      "",
    ].join("\n"),
  );

  await execFileAsync("node", [
    scriptPath,
    "--source",
    sourcePath,
    "--out-dir",
    outDir,
    "--codex-config",
    codexConfigPath,
  ]);

  const updatedConfig = await readFile(codexConfigPath, "utf8");

  assert.match(updatedConfig, /personality = "friendly"/);
  assert.match(updatedConfig, /\[profiles\.local\]/);
  assert.doesNotMatch(updatedConfig, /mcp_servers\.old/);
  assert.doesNotMatch(updatedConfig, /stale/);
  assert.match(updatedConfig, /\[mcp_servers\.serena\]/);
  assert.match(updatedConfig, /"--open-web-dashboard", "false"/);
  assert.match(updatedConfig, /\[mcp_servers\.vercel\]/);
});
