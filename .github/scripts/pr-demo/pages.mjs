import { createHash } from "node:crypto";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function assertManifestUrl(value, headSha) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !/^[A-Za-z0-9.-]+\.github\.io$/.test(url.hostname) ||
    !url.pathname.endsWith(`/${headSha}/manifest.json`) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Pages manifest URLが不正です");
  }
  return url.toString();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitForPublishedManifest({
  url,
  headSha,
  manifestSha256,
  attempts = 30,
  intervalMs = 10_000,
  fetchImpl = fetch,
  sleepImpl = sleep,
}) {
  if (
    !SHA_PATTERN.test(headSha) ||
    !SHA256_PATTERN.test(manifestSha256 ?? "") ||
    !Number.isSafeInteger(attempts) ||
    attempts <= 0 ||
    attempts > 60 ||
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < 0 ||
    intervalMs > 60_000
  ) {
    throw new Error("Pages確認条件が不正です");
  }
  const manifestUrl = assertManifestUrl(url, headSha);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(manifestUrl, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const text = await response.text();
        if (text.length <= 1024 * 1024) {
          const manifest = JSON.parse(text);
          const actualSha256 = createHash("sha256").update(text).digest("hex");
          if (manifest.headSha === headSha && actualSha256 === manifestSha256) {
            return manifest;
          }
        }
      }
    } catch (error) {
      console.log(`[pr-demo] Pages確認 ${attempt}/${attempts}: ${error.message}`);
    }

    if (attempt < attempts) {
      await sleepImpl(intervalMs);
    }
  }
  throw new Error("GitHub Pagesで今回のmanifestを確認できませんでした");
}
