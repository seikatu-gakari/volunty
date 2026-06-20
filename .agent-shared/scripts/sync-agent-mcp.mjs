#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(__dirname, "..");
const defaultSource = path.join(sharedRoot, "mcp", "servers.json");
const defaultOutDir = path.join(sharedRoot, "mcp", "generated");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const item = process.argv[i];
  if (!item.startsWith("--")) {
    continue;
  }
  const key = item.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, true);
  }
}

const sourcePath = path.resolve(String(args.get("source") || defaultSource));
const outDir = path.resolve(String(args.get("out-dir") || defaultOutDir));
const stdoutOnly = args.has("stdout");
const codexConfigPath = args.has("codex-config")
  ? path.resolve(String(args.get("codex-config")))
  : null;

const raw = JSON.parse(await readFile(sourcePath, "utf8"));
const servers = raw.servers && typeof raw.servers === "object" ? raw.servers : raw;

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null),
  );
}

function toClaudeServer(server) {
  const base = { type: server.type };

  if (server.type === "stdio") {
    return cleanObject({
      ...base,
      command: server.command,
      args: server.args || [],
      env: server.env || undefined,
    });
  }

  if (server.type === "http" || server.type === "sse") {
    return cleanObject({
      ...base,
      url: server.url,
      headers: server.headers || undefined,
    });
  }

  throw new Error(`Unsupported MCP server type: ${server.type}`);
}

function tomlString(value) {
  return JSON.stringify(value);
}

function tomlValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(tomlValue).join(", ")}]`;
  }
  if (typeof value === "string") {
    return tomlString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  throw new Error(`Unsupported TOML value: ${JSON.stringify(value)}`);
}

function pushScalar(lines, key, value) {
  if (value === undefined || value === null) {
    return;
  }
  lines.push(`${key} = ${tomlValue(value)}`);
}

function pushInlineObject(lines, key, value) {
  if (!value || Object.keys(value).length === 0) {
    return;
  }
  const body = Object.entries(value)
    .map(([objectKey, objectValue]) => `${tomlString(objectKey)} = ${tomlValue(objectValue)}`)
    .join(", ");
  lines.push(`${key} = { ${body} }`);
}

function toCodexToml(allServers, options = {}) {
  const lines =
    options.headerLines ||
    [
      "# Generated from ~/.agent-shared/mcp/servers.json.",
      "# Review this file before copying sections into ~/.codex/config.toml or .codex/config.toml.",
    ];

  for (const [name, server] of Object.entries(allServers)) {
    lines.push("", `[mcp_servers.${name}]`);

    if (server.type === "stdio") {
      pushScalar(lines, "command", server.command);
      pushScalar(lines, "args", server.args || []);
      pushScalar(lines, "cwd", server.cwd);
      pushScalar(lines, "env_vars", server.env_vars);
    } else if (server.type === "http" || server.type === "sse") {
      pushScalar(lines, "url", server.url);
      pushScalar(lines, "bearer_token_env_var", server.bearer_token_env_var);
      pushInlineObject(lines, "http_headers", server.http_headers);
      pushInlineObject(lines, "env_http_headers", server.env_http_headers);
    } else {
      throw new Error(`Unsupported MCP server type: ${server.type}`);
    }

    pushScalar(lines, "startup_timeout_sec", server.startup_timeout_sec);
    pushScalar(lines, "tool_timeout_sec", server.tool_timeout_sec);
    pushScalar(lines, "enabled", server.enabled);

    if (server.env && Object.keys(server.env).length > 0) {
      lines.push("", `[mcp_servers.${name}.env]`);
      for (const [envKey, envValue] of Object.entries(server.env)) {
        pushScalar(lines, envKey, envValue);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function isTomlTableHeader(line) {
  return /^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(line);
}

function isMcpTableHeader(line) {
  return /^\s*\[mcp_servers(?:\]|\.)/.test(line);
}

function stripCodexMcpSections(toml) {
  const lines = toml.replace(/\r\n/g, "\n").split("\n");
  const keptLines = [];
  let skippingMcpSection = false;

  for (const line of lines) {
    if (isMcpTableHeader(line)) {
      skippingMcpSection = true;
      continue;
    }

    if (skippingMcpSection) {
      if (isTomlTableHeader(line)) {
        skippingMcpSection = false;
        keptLines.push(line);
      }
      continue;
    }

    keptLines.push(line);
  }

  while (keptLines.at(-1)?.trim() === "") {
    keptLines.pop();
  }

  return keptLines.join("\n");
}

function mergeCodexConfig(existingToml, generatedMcpToml) {
  const nonMcpToml = stripCodexMcpSections(existingToml).trimEnd();
  const mcpToml = generatedMcpToml.trimEnd();

  if (!nonMcpToml) {
    return `${mcpToml}\n`;
  }

  return `${nonMcpToml}\n\n${mcpToml}\n`;
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

const claudeConfig = {
  mcpServers: Object.fromEntries(
    Object.entries(servers).map(([name, server]) => [name, toClaudeServer(server)]),
  ),
};
const claudeJson = `${JSON.stringify(claudeConfig, null, 2)}\n`;
const codexToml = toCodexToml(servers);
const codexConfigMcpToml = toCodexToml(servers, {
  headerLines: [
    "# MCP server sections generated from .agent-shared/mcp/servers.json.",
    "# Edit .agent-shared/mcp/servers.json, then rerun:",
    "# node .agent-shared/scripts/sync-agent-mcp.mjs --codex-config .codex/config.toml",
  ],
});

if (stdoutOnly) {
  console.log("## claude.mcp.json");
  console.log(claudeJson);
  console.log("## codex.config.generated.toml");
  console.log(codexToml);
} else {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "claude.mcp.json"), claudeJson);
  await writeFile(path.join(outDir, "codex.config.generated.toml"), codexToml);
  console.log(`Generated ${path.join(outDir, "claude.mcp.json")}`);
  console.log(`Generated ${path.join(outDir, "codex.config.generated.toml")}`);

  if (codexConfigPath) {
    const existingCodexConfig = await readOptionalFile(codexConfigPath);
    const updatedCodexConfig = mergeCodexConfig(existingCodexConfig, codexConfigMcpToml);
    await mkdir(path.dirname(codexConfigPath), { recursive: true });
    await writeFile(codexConfigPath, updatedCodexConfig);
    console.log(`Updated ${codexConfigPath}`);
  } else {
    console.log("既存の Claude Code/Codex MCP 設定は上書きしていません。");
  }
}
