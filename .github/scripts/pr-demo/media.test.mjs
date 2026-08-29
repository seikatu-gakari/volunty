import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createTestMedia } from "./test-media-helper.mjs";
import { validateMediaContent, validateProbeMetadata } from "./media.mjs";

test("H.264・無音・所定size・15〜45秒のMP4と完全なGIFを受理する", async (t) => {
  const media = await createTestMedia();
  t.after(media.cleanup);

  await validateMediaContent(media.mp4Path, {
    kind: "mp4",
    viewport: "desktop",
    durationSeconds: media.durationSeconds,
  });
  await validateMediaContent(media.gifPath, {
    kind: "gif",
    viewport: "desktop",
    durationSeconds: media.durationSeconds,
  });
});

test("magic headerだけを偽装したmediaを拒否する", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-fake-media-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fakeMp4 = join(directory, "desktop.mp4");
  const fakeGif = join(directory, "desktop.gif");
  await writeFile(
    fakeMp4,
    Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom-not-a-video")]),
  );
  await writeFile(fakeGif, Buffer.from("GIF89a-not-an-image"));

  await assert.rejects(
    validateMediaContent(fakeMp4, {
      kind: "mp4",
      viewport: "desktop",
      durationSeconds: 20,
    }),
    /ffprobe|media metadata|dimensions/,
  );
  await assert.rejects(
    validateMediaContent(fakeGif, {
      kind: "gif",
      viewport: "desktop",
      durationSeconds: 20,
    }),
    /ffprobe|media metadata|dimensions/,
  );
});

test("codec・audio・dimensions・durationを個別に検証する", () => {
  const video = {
    codec_type: "video",
    codec_name: "h264",
    width: 1280,
    height: 720,
  };
  const metadata = (overrides = {}) => ({
    probe: {
      streams: [video],
      format: { duration: "20" },
      ...overrides,
    },
    kind: "mp4",
    viewport: "desktop",
    durationSeconds: 20,
  });

  assert.throws(
    () =>
      validateProbeMetadata(
        metadata({ streams: [{ ...video, codec_name: "vp9" }] }),
      ),
    /H\.264/,
  );
  assert.throws(
    () =>
      validateProbeMetadata(
        metadata({ streams: [video, { codec_type: "audio", codec_name: "aac" }] }),
      ),
    /audio streamなし/,
  );
  assert.throws(
    () =>
      validateProbeMetadata(
        metadata({ streams: [{ ...video, width: 640, height: 480 }] }),
      ),
    /dimensions/,
  );
  assert.throws(
    () => validateProbeMetadata(metadata({ format: { duration: "2" } })),
    /duration/,
  );
});

test("metadataが正しくても最後までdecodeできないmediaを拒否する", async () => {
  const runCommand = async (command) => {
    if (command === "ffprobe") {
      return {
        stdout: JSON.stringify({
          streams: [
            {
              codec_type: "video",
              codec_name: "h264",
              width: 1280,
              height: 720,
            },
          ],
          format: { duration: "20" },
        }),
      };
    }
    throw new Error("decode failed");
  };

  await assert.rejects(
    validateMediaContent(
      "/tmp/untrusted.mp4",
      { kind: "mp4", viewport: "desktop", durationSeconds: 20 },
      { runCommand },
    ),
    /最後までdecodeできません/,
  );
});
