export type Percentiles = {
  p50: number;
  p75: number;
  p95: number;
};

function nearestRank(sortedSamples: number[], percentile: number) {
  const rank = Math.ceil((percentile / 100) * sortedSamples.length);
  return sortedSamples[Math.max(0, rank - 1)];
}

/**
 * Nearest-rank方式で測定値の百分位を求める。
 * 20回測定時は、p75 が並べ替え後15番目（1始まり）になる。
 */
export function calculatePercentiles(samples: number[]): Percentiles {
  if (samples.length === 0) {
    throw new Error("パーセンタイル計算には少なくとも1件の測定値が必要です");
  }

  const sortedSamples = [...samples].sort((left, right) => left - right);

  return {
    p50: nearestRank(sortedSamples, 50),
    p75: nearestRank(sortedSamples, 75),
    p95: nearestRank(sortedSamples, 95),
  };
}
