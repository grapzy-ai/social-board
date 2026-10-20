import { describe, it, expect } from "vitest";
import { placeEndLabels, directLabelsFor } from "@/lib/ui/chart-labels";

describe("chart end labels", () => {
  it("direct labels up to 6 series, legend beyond", () => {
    expect(directLabelsFor(1)).toBe(true);
    expect(directLabelsFor(6)).toBe(true);
    expect(directLabelsFor(7)).toBe(false);
  });
  it("nudges overlapping labels apart while keeping order", () => {
    const placed = placeEndLabels([{ key: "a", y: 100 }, { key: "b", y: 104 }, { key: "c", y: 300 }], 14);
    const y = Object.fromEntries(placed.map((p) => [p.key, p.y]));
    expect(y.b - y.a).toBeGreaterThanOrEqual(14);
    expect(y.c).toBe(300);
    expect(y.a).toBeLessThan(y.b);
  });
});
