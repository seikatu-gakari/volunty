import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";

const VIEWPORTS = new Set(["desktop", "mobile"]);

export function buildPlaywrightArgs({ spec, tag, viewport, listOnly }) {
  if (!VIEWPORTS.has(viewport)) {
    throw new Error(`未対応のviewportです: ${viewport}`);
  }
  if (
    !/^e2e\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(spec) ||
    spec.split("/").includes("..") ||
    !/^@demo-[1-9][0-9]*$/.test(tag)
  ) {
    throw new Error("Playwrightへ渡すspecまたはtagが不正です");
  }

  const args = [
    "playwright",
    "test",
    spec,
    "--config=playwright.demo.config.ts",
    `--project=demo-${viewport}`,
    "--grep",
    `(?:^|\\s)${tag}(?:\\s|$)`,
    "--workers=1",
  ];
  if (listOnly) {
    args.push("--list", "--reporter=json");
  }
  return args;
}

function collectTests(suite, tests) {
  for (const spec of suite.specs ?? []) {
    tests.push(...(spec.tests ?? []));
  }
  for (const child of suite.suites ?? []) {
    collectTests(child, tests);
  }
}

export function countSelectedDemoTests(report, viewport) {
  const tests = [];
  for (const suite of report.suites ?? []) {
    collectTests(suite, tests);
  }
  const projectName = `demo-${viewport}`;
  const count = tests.filter((candidate) => candidate.projectName === projectName).length;
  if (count !== 1) {
    throw new Error(`${projectName}の対象テストは正確に1件必要です（実際: ${count}件）`);
  }
  return count;
}

export function assertDemoDuration(durationSeconds) {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 15 ||
    durationSeconds > 45
  ) {
    throw new Error("動作ビデオは15〜45秒にしてください");
  }
  return durationSeconds;
}

async function collectFiles(directory, suffix, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, suffix, files);
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(path);
    }
  }
}

export async function findRecordedVideo(directory) {
  const files = [];
  await collectFiles(directory, ".webm", files);
  if (files.length !== 1) {
    throw new Error(`録画されたwebmは正確に1件必要です（実際: ${files.length}件）`);
  }
  return files[0];
}

export function buildMp4Args(inputPath, outputPath) {
  return [
    "-y",
    "-i",
    inputPath,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}

export function buildGifArgs(inputPath, outputPath) {
  return [
    "-y",
    "-i",
    inputPath,
    "-filter_complex",
    "fps=8,scale='min(960\\,iw)':-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
    "-an",
    outputPath,
  ];
}

export function parseFfprobeDuration(output) {
  const duration = Number.parseFloat(output.trim());
  if (!Number.isFinite(duration)) {
    throw new Error("ffprobeから動画時間を取得できません");
  }
  return duration;
}

async function describeFile(path) {
  const fileStat = await stat(path);
  const content = await readFile(path);
  return {
    file: basename(path),
    bytes: fileStat.size,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

export async function buildManifest({ decision, generatedAt, media }) {
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("generatedAtが不正です");
  }
  if (
    media.length !== decision.contract.viewports.length ||
    !decision.contract.viewports.every((viewport) =>
      media.some((entry) => entry.viewport === viewport),
    )
  ) {
    throw new Error("decisionのviewportと生成mediaが一致しません");
  }

  return {
    schemaVersion: 1,
    prNumber: decision.prNumber,
    headSha: decision.headSha,
    repository: decision.baseRepository,
    environment: "ci-local",
    generatedAt,
    spec: decision.contract.spec,
    tag: decision.contract.tag,
    viewports: decision.contract.viewports,
    media: await Promise.all(
      media.map(async (entry) => ({
        viewport: entry.viewport,
        durationSeconds: assertDemoDuration(entry.durationSeconds),
        gif: await describeFile(entry.gifPath),
        mp4: await describeFile(entry.mp4Path),
      })),
    ),
  };
}
