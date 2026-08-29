import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MIN_DURATION_SECONDS = 15;
const MAX_DURATION_SECONDS = 45;
const MAX_PROBE_OUTPUT_BYTES = 1024 * 1024;
const COMMAND_TIMEOUT_MS = 30_000;

const EXPECTED_DIMENSIONS = {
  desktop: {
    mp4: { width: 1280, height: 720 },
    gif: { width: 960, height: 540 },
  },
  mobile: {
    mp4: { width: 390, height: 844 },
    gif: { width: 390, height: 844 },
  },
};

async function runCommand(command, args) {
  return execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: MAX_PROBE_OUTPUT_BYTES,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true,
  });
}

function readDuration(probe) {
  const value = Number.parseFloat(
    probe?.format?.duration ?? probe?.streams?.[0]?.duration ?? "",
  );
  if (!Number.isFinite(value)) {
    throw new Error("media metadataからdurationを取得できません");
  }
  return value;
}

export function validateProbeMetadata({ probe, kind, viewport, durationSeconds }) {
  const dimensions = EXPECTED_DIMENSIONS[viewport]?.[kind];
  if (!dimensions || !["gif", "mp4"].includes(kind)) {
    throw new Error("media metadataのviewportまたはkindが不正です");
  }
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < MIN_DURATION_SECONDS ||
    durationSeconds > MAX_DURATION_SECONDS
  ) {
    throw new Error("manifestのdurationは15〜45秒である必要があります");
  }
  if (!Array.isArray(probe?.streams) || probe.streams.length !== 1) {
    throw new Error("mediaはvideo streamが正確に1件で、audio streamなしである必要があります");
  }
  const stream = probe.streams[0];
  if (stream.codec_type !== "video") {
    throw new Error("mediaの唯一のstreamはvideoである必要があります");
  }
  if (kind === "mp4" && stream.codec_name !== "h264") {
    throw new Error("MP4のvideo codecはH.264である必要があります");
  }
  if (kind === "gif" && stream.codec_name !== "gif") {
    throw new Error("GIFのvideo codecが不正です");
  }
  if (stream.width !== dimensions.width || stream.height !== dimensions.height) {
    throw new Error(
      `${viewport}.${kind}のdimensionsは${dimensions.width}x${dimensions.height}である必要があります`,
    );
  }

  const actualDuration = readDuration(probe);
  if (
    actualDuration < MIN_DURATION_SECONDS ||
    actualDuration > MAX_DURATION_SECONDS ||
    Math.abs(actualDuration - durationSeconds) > 1
  ) {
    throw new Error(`${viewport}.${kind}のdurationがmanifestまたは15〜45秒の範囲と一致しません`);
  }
  return actualDuration;
}

export async function validateMediaContent(
  path,
  { kind, viewport, durationSeconds },
  { runCommand: execute = runCommand } = {},
) {
  let probe;
  try {
    const { stdout } = await execute("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,duration:format=duration",
      "-of",
      "json",
      path,
    ]);
    if (typeof stdout !== "string" || Buffer.byteLength(stdout) > MAX_PROBE_OUTPUT_BYTES) {
      throw new Error("ffprobe outputが不正です");
    }
    probe = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`ffprobeでmedia metadataを検証できません: ${error.message}`);
  }

  validateProbeMetadata({ probe, kind, viewport, durationSeconds });

  try {
    await execute("ffmpeg", [
      "-v",
      "error",
      "-xerror",
      "-threads",
      "1",
      "-i",
      path,
      "-map",
      "0:v:0",
      "-t",
      "46",
      "-f",
      "null",
      "-",
    ]);
  } catch (error) {
    throw new Error(`ffmpegでmediaを最後までdecodeできません: ${error.message}`);
  }
}
