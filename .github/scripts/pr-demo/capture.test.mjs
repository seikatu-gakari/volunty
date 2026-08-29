import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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

test("Playwright引数をshell文字列に連結せず配列で構築する", () => {
  assert.deepEqual(
    buildPlaywrightArgs({
      spec: "e2e/participant-discovery.spec.ts",
      tag: "@demo-221",
      viewport: "desktop",
      listOnly: false,
    }),
    [
      "playwright",
      "test",
      "e2e/participant-discovery.spec.ts",
      "--config=playwright.demo.config.ts",
      "--project=demo-desktop",
      "--grep",
      "(?:^|\\s)@demo-221(?:\\s|$)",
      "--workers=1",
    ],
  );
});

test("JSON reportから対象projectのテストだけを数える", () => {
  const report = {
    suites: [
      {
        suites: [],
        specs: [
          {
            tests: [
              { projectName: "setup" },
              { projectName: "demo-desktop" },
              { projectName: "demo-mobile" },
            ],
          },
        ],
      },
    ],
  };

  assert.equal(countSelectedDemoTests(report, "desktop"), 1);
});

test("対象テストが複数なら録画を拒否する", () => {
  const report = {
    suites: [
      {
        specs: [
          {
            tests: [
              { projectName: "demo-desktop" },
              { projectName: "demo-desktop" },
            ],
          },
        ],
      },
    ],
  };

  assert.throws(
    () => countSelectedDemoTests(report, "desktop"),
    /demo-desktopの対象テストは正確に1件必要です/,
  );
});

test("動画時間を15〜45秒に制限する", () => {
  assert.equal(assertDemoDuration(15), 15);
  assert.equal(assertDemoDuration(45), 45);
  assert.throws(() => assertDemoDuration(14.99), /15〜45秒/);
  assert.throws(() => assertDemoDuration(45.01), /15〜45秒/);
});

test("録画先から唯一のwebmを解決する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-video-"));
  const nested = join(directory, "nested");
  await mkdir(nested);
  await writeFile(join(nested, "video.webm"), "webm");

  assert.equal(await findRecordedVideo(directory), join(nested, "video.webm"));
  await writeFile(join(directory, "another.webm"), "webm");
  await assert.rejects(findRecordedVideo(directory), /webmは正確に1件必要です/);
});

test("MP4変換はH.264・yuv420p・無音を明示する", () => {
  assert.deepEqual(buildMp4Args("input.webm", "output.mp4"), [
    "-y",
    "-i",
    "input.webm",
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "output.mp4",
  ]);
});

test("GIF変換は8fps・最大960px・palette最適化を使う", () => {
  const args = buildGifArgs("input.webm", "output.gif");
  assert.deepEqual(args.slice(0, 3), ["-y", "-i", "input.webm"]);
  assert.match(args[4], /fps=8/);
  assert.match(args[4], /min\(960\\,iw\)/);
  assert.match(args[4], /palettegen/);
  assert.equal(args.at(-1), "output.gif");
});

test("ffprobe出力を秒数へ変換する", () => {
  assert.equal(parseFfprobeDuration("20.125\n"), 20.125);
  assert.throws(() => parseFfprobeDuration("N/A\n"), /動画時間を取得できません/);
});

test("生成mediaからpublisher用manifestを作る", async () => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-capture-"));
  const gifPath = join(directory, "desktop.gif");
  const mp4Path = join(directory, "desktop.mp4");
  await writeFile(gifPath, "GIF89a-demo");
  await writeFile(mp4Path, Buffer.concat([Buffer.from([0, 0, 0, 16]), Buffer.from("ftypdemo") ]));

  const manifest = await buildManifest({
    decision: {
      prNumber: 321,
      headSha: "b".repeat(40),
      baseRepository: "seikatu-gakari/volunty",
      contract: {
        spec: "e2e/participant-discovery.spec.ts",
        tag: "@demo-221",
        viewports: ["desktop"],
      },
    },
    generatedAt: "2026-08-29T00:05:00.000Z",
    media: [{ viewport: "desktop", durationSeconds: 20, gifPath, mp4Path }],
  });

  assert.equal(manifest.environment, "ci-local");
  assert.equal(manifest.media[0].gif.file, "desktop.gif");
  assert.equal(manifest.media[0].gif.bytes, 11);
  assert.match(manifest.media[0].gif.sha256, /^[0-9a-f]{64}$/);
  assert.equal(manifest.media[0].durationSeconds, 20);
});
