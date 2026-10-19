import { describe, it, expect } from "vitest";
import { snapshotForDay, multiplier } from "@/lib/metrics/multiplier";

describe("snapshotForDay", () => {
  const snaps = [
    { dayIndex: 1, views: 10 },
    { dayIndex: 7, views: 50 },
    { dayIndex: 30, views: 90 },
  ];
  it("picks the latest snapshot at or before day 11", () => {
    expect(snapshotForDay(snaps)).toEqual({ dayIndex: 7, views: 50 });
  });
  it("picks the exact day-11 snapshot when present", () => {
    expect(snapshotForDay([...snaps, { dayIndex: 11, views: 70 }])).toEqual({ dayIndex: 11, views: 70 });
  });
  it("returns null when no snapshot is at or before the cutoff", () => {
    expect(snapshotForDay([{ dayIndex: 30, views: 90 }])).toBeNull();
    expect(snapshotForDay([])).toBeNull();
  });
});

describe("multiplier", () => {
  it("divides views by benchmark rounded to hundredths", () => {
    expect(multiplier(1200, 470)).toBe(2.55);
  });
  it("is null without views, without benchmark, or with a zero benchmark", () => {
    expect(multiplier(null, 470)).toBeNull();
    expect(multiplier(100, null)).toBeNull();
    expect(multiplier(100, 0)).toBeNull();
  });
});

describe("pickMultiplierSnapshot", () => {
  it("prefers the latest snapshot at or before day 11 (not provisional)", async () => {
    const { pickMultiplierSnapshot } = await import("@/lib/metrics/multiplier");
    expect(pickMultiplierSnapshot([{ dayIndex: 7, views: 5 }, { dayIndex: 30, views: 9 }])).toEqual({ snap: { dayIndex: 7, views: 5 }, provisional: false });
  });
  it("falls back to the earliest later snapshot and marks it provisional", async () => {
    const { pickMultiplierSnapshot } = await import("@/lib/metrics/multiplier");
    expect(pickMultiplierSnapshot([{ dayIndex: 30, views: 9 }, { dayIndex: 20, views: 7 }])).toEqual({ snap: { dayIndex: 20, views: 7 }, provisional: true });
    expect(pickMultiplierSnapshot([])).toEqual({ snap: null, provisional: false });
  });
});
