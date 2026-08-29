import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createTestMedia(viewport = "desktop") {
  const dimensions =
    viewport === "desktop"
      ? { mp4: "1280x720", gif: "960x540" }
      : { mp4: "390x844", gif: "390x844" };
  const directory = await mkdtemp(join(tmpdir(), "volunty-pr-demo-media-"));
  const mp4Path = join(directory, `${viewport}.mp4`);
  const gifPath = join(directory, `${viewport}.gif`);

  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${dimensions.mp4}:r=8:d=16`,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4Path,
  ]);
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${dimensions.gif}:r=8:d=16`,
    gifPath,
  ]);

  return {
    durationSeconds: 16,
    gif: readFileSync(gifPath),
    gifPath,
    mp4: readFileSync(mp4Path),
    mp4Path,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}
