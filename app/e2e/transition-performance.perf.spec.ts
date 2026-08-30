import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { calculatePercentiles } from "../src/lib/performance/metrics";

const SAMPLE_COUNT = 20;
const VIEWPORT = { width: 1440, height: 900 };

const baseURL = process.env.PERF_BASE_URL;
const storageState = process.env.PERF_STORAGE_STATE;

if (!baseURL || !storageState) {
  throw new Error("PERF_BASE_URL と PERF_STORAGE_STATE は性能計測に必須です。");
}

type Transition = {
  name: string;
  sourcePath: string;
  linkName: string | RegExp;
  targetHeading: string | RegExp;
};

const transitions: Transition[] = [
  {
    name: "home-to-mypage",
    sourcePath: "/",
    linkName: "マイページ",
    targetHeading: "マイページ",
  },
  {
    name: "mypage-to-home",
    sourcePath: "/mypage",
    linkName: /ボランティ/,
    targetHeading: /さん$/,
  },
  {
    name: "home-to-recommendations",
    sourcePath: "/",
    linkName: "おすすめ案件",
    targetHeading: "おすすめ案件",
  },
];

test("主要遷移を各20回計測してJSONを出力する", async ({ browser }, testInfo) => {
  const results = [];

  for (const transition of transitions) {
    const samples: number[] = [];

    for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
      const context = await browser.newContext({ storageState, viewport: VIEWPORT });
      const page = await context.newPage();

      try {
        await page.goto(new URL(transition.sourcePath, baseURL).toString());
        const startedAt = performance.now();
        await page
          .getByRole("link", { name: transition.linkName, exact: typeof transition.linkName === "string" })
          .first()
          .click();
        await expect(
          page.getByRole("main").getByRole("heading", {
            name: transition.targetHeading,
            level: 1,
          }),
        ).toBeVisible();
        samples.push(performance.now() - startedAt);
      } finally {
        await context.close();
      }
    }

    results.push({
      ...transition,
      rawSamplesMs: samples,
      ...calculatePercentiles(samples),
    });
  }

  const benchmark = {
    baseURL,
    viewport: VIEWPORT,
    timestamp: new Date().toISOString(),
    percentileMethod: "nearest-rank: ceil(percentile / 100 * sampleCount)",
    sampleCount: SAMPLE_COUNT,
    results,
  };
  const json = `${JSON.stringify(benchmark, null, 2)}\n`;
  const artifactPath = testInfo.outputPath("transition-performance.json");

  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, json, "utf8");
  console.log(json);
});
