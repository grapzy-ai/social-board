export const MIN_BENCHMARK_SAMPLE = 5;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median of day-11 views; null when fewer than MIN_BENCHMARK_SAMPLE valid values. */
export function computeBenchmark(day11Values: (number | null)[]): number | null {
  const valid = day11Values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (valid.length < MIN_BENCHMARK_SAMPLE) return null;
  return median(valid);
}
