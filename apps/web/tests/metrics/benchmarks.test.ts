import { describe, it, expect } from "vitest";
import { median, computeBenchmark } from "@/lib/metrics/benchmarks";

describe("median", () => {
  it("returns the middle value for odd and the mean of middles for even", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("returns null for an empty list", () => {
    expect(median([])).toBeNull();
  });
});

describe("computeBenchmark", () => {
  it("returns null when fewer than 5 valid values", () => {
    expect(computeBenchmark([100, 200, null, 300, 400])).toBeNull();
  });
  it("returns the median of valid values when 5 or more", () => {
    expect(computeBenchmark([100, 200, 300, 400, 1000])).toBe(300);
    expect(computeBenchmark([100, 200, 300, 400, 1000, null])).toBe(300);
  });
});
