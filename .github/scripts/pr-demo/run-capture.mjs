#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertDemoDuration,
  buildGifArgs,
  buildManifest,
  buildMp4Args,
  buildPlaywrightArgs,
  countSelectedDemoTests,
  findRecordedVideo,
  parseFfprobeDuration,
} from "./capture.mjs";
import { validateArtifactDirectory } from "./artifact.mjs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) {
    throw new Error(`${command}を起動できません: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : "";
    throw new Error(`${command}がexit ${result.status}で失敗しました${detail}`);
  }
  return options.capture ? result.stdout : "";
}

function ensureSafeDirectory(path, label) {
  const absolute = resolve(path);
  if (absolute === parse(absolute).root) {
    throw new Error(`${label}にfilesystem rootは指定できません`);
  }
  return absolute;
}

function readListReport(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Playwright --listのJSONを解析できません: ${error.message}`);
  }
}

function probeDuration(videoPath, cwd) {
  const output = run(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ],
    { cwd, capture: true },
  );
  return assertDemoDuration(parseFfprobeDuration(output));
}

async function captureViewport({
  decision,
  viewport,
  artifactDirectory,
  testOutputRoot,
  appDirectory,
  repositoryRoot,
}) {
  const testOutputDirectory = join(testOutputRoot, viewport);
  await rm(testOutputDirectory, { recursive: true, force: true });
  await mkdir(testOutputDirectory, { recursive: true });

  run("supabase", ["db", "reset", "--local"], { cwd: repositoryRoot });

  const environment = {
    ...process.env,
    PR_DEMO_TEST_OUTPUT_DIR: testOutputDirectory,
  };
  const listOutput = run(
    "npx",
    buildPlaywrightArgs({
      spec: decision.contract.spec,
      tag: decision.contract.tag,
      viewport,
      listOnly: true,
    }),
    { cwd: appDirectory, env: environment, capture: true },
  );
  countSelectedDemoTests(readListReport(listOutput), viewport);

  run(
    "npx",
    buildPlaywrightArgs({
      spec: decision.contract.spec,
      tag: decision.contract.tag,
      viewport,
      listOnly: false,
    }),
    { cwd: appDirectory, env: environment },
  );

  const webmPath = await findRecordedVideo(testOutputDirectory);
  const durationSeconds = probeDuration(webmPath, appDirectory);
  const mp4Path = join(artifactDirectory, `${viewport}.mp4`);
  const gifPath = join(artifactDirectory, `${viewport}.gif`);
  run("ffmpeg", buildMp4Args(webmPath, mp4Path), { cwd: appDirectory });
  run("ffmpeg", buildGifArgs(webmPath, gifPath), { cwd: appDirectory });

  return { viewport, durationSeconds, gifPath, mp4Path };
}

export async function main({
  decisionPath = process.env.PR_DEMO_DECISION_PATH,
  artifactDirectory = process.env.PR_DEMO_ARTIFACT_DIR,
  testOutputRoot = process.env.PR_DEMO_TEST_OUTPUT_ROOT,
  appDirectory = process.cwd(),
} = {}) {
  if (!decisionPath || !artifactDirectory) {
    throw new Error("PR_DEMO_DECISION_PATHとPR_DEMO_ARTIFACT_DIRが必要です");
  }

  const safeArtifactDirectory = ensureSafeDirectory(artifactDirectory, "artifact directory");
  const safeTestOutputRoot = ensureSafeDirectory(
    testOutputRoot ?? join(appDirectory, "test-results", "pr-demo-recordings"),
    "test output root",
  );
  if (
    resolve(decisionPath) !== join(safeArtifactDirectory, "decision.json") ||
    basename(decisionPath) !== "decision.json"
  ) {
    throw new Error("decision.jsonはartifact directory直下に置いてください");
  }

  const decision = JSON.parse(await readFile(decisionPath, "utf8"));
  if (decision.outcome !== "capture" || !decision.contract?.required) {
    throw new Error("capture対象のdecisionが必要です");
  }

  await mkdir(safeArtifactDirectory, { recursive: true });
  await mkdir(safeTestOutputRoot, { recursive: true });
  const repositoryRoot = resolve(appDirectory, "..");
  const media = [];
  for (const viewport of decision.contract.viewports) {
    media.push(
      await captureViewport({
        decision,
        viewport,
        artifactDirectory: safeArtifactDirectory,
        testOutputRoot: safeTestOutputRoot,
        appDirectory,
        repositoryRoot,
      }),
    );
  }

  const manifest = await buildManifest({
    decision,
    generatedAt: new Date().toISOString(),
    media,
  });
  await writeFile(
    join(safeArtifactDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 },
  );
  await validateArtifactDirectory(safeArtifactDirectory, {
    prNumber: decision.prNumber,
    headSha: decision.headSha,
    repository: decision.baseRepository,
    headRepository: decision.headRepository,
  });
  console.log(
    `[pr-demo] ${decision.contract.viewports.join(",")}の動画とmanifestを生成しました`,
  );
  return manifest;
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await main();
}
