import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { main } from "./run-capture.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function writeExecutable(path, source) {
  await writeFile(path, `#!/usr/bin/env node\n${source}`, { mode: 0o755 });
}

test("fork PRの録画artifactをfork側head repositoryで検証する", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-run-capture-"));
  const binDirectory = join(directory, "bin");
  const artifactDirectory = join(directory, "artifact");
  const outputDirectory = join(directory, "output");
  await mkdir(binDirectory, { recursive: true });
  await mkdir(artifactDirectory, { recursive: true });
  t.after(() => rm(directory, { recursive: true, force: true }));

  await Promise.all([
    writeExecutable(join(binDirectory, "supabase"), "process.exit(0);\n"),
    writeExecutable(
      join(binDirectory, "npx"),
      `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (args.includes("--list")) {
  process.stdout.write(JSON.stringify({
    suites: [{ specs: [{ tests: [{ projectName: "demo-desktop" }] }] }],
  }));
} else {
  fs.mkdirSync(process.env.PR_DEMO_TEST_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.PR_DEMO_TEST_OUTPUT_DIR, "video.webm"), "webm");
}
`,
    ),
    writeExecutable(
      join(binDirectory, "ffprobe"),
      `const args = process.argv.slice(2);
if (args.includes("json")) {
  const isGif = args.at(-1).endsWith(".gif");
  process.stdout.write(JSON.stringify({
    streams: [{
      codec_type: "video",
      codec_name: isGif ? "gif" : "h264",
      width: isGif ? 960 : 1280,
      height: isGif ? 540 : 720,
    }],
    format: { duration: "16" },
  }));
} else {
  process.stdout.write("16\\n");
}
`,
    ),
    writeExecutable(
      join(binDirectory, "ffmpeg"),
      `const fs = require("node:fs");
const output = process.argv.at(-1);
if (output.endsWith(".mp4")) {
  fs.writeFileSync(output, Buffer.concat([
    Buffer.from([0, 0, 0, 16]),
    Buffer.from("ftypisom"),
  ]));
} else if (output.endsWith(".gif")) {
  fs.writeFileSync(output, Buffer.from("GIF89a-demo"));
}
`,
    ),
  ]);

  const decision = {
    schemaVersion: 1,
    outcome: "capture",
    required: true,
    uiChange: true,
    reason: "変更点を示す動作ビデオを生成します",
    contract: {
      version: 1,
      required: true,
      spec: "e2e/participant-discovery.spec.ts",
      tag: "@demo-229",
      viewports: ["desktop"],
      reason: "",
    },
    prNumber: 229,
    baseSha: "a".repeat(40),
    headSha: "b".repeat(40),
    baseRepository: "seikatu-gakari/volunty",
    headRepository: "contributor/volunty",
    changedFiles: ["app/src/app/page.tsx"],
    evaluatedAt: "2026-08-29T00:00:00.000Z",
  };
  const decisionPath = join(artifactDirectory, "decision.json");
  await writeFile(decisionPath, JSON.stringify(decision));

  const previousPath = process.env.PATH;
  process.env.PATH = `${binDirectory}${delimiter}${previousPath ?? ""}`;
  t.after(() => {
    process.env.PATH = previousPath;
  });

  await main({
    decisionPath,
    artifactDirectory,
    testOutputRoot: outputDirectory,
    appDirectory: join(repositoryRoot, "app"),
  });

  const manifest = JSON.parse(
    await readFile(join(artifactDirectory, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.repository, "seikatu-gakari/volunty");
});
