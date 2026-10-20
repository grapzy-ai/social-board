import { describe, it, expect } from "vitest";
import { resolvePeriod } from "@/lib/ui/period";

const T = "2026-10-20";

describe("resolvePeriod", () => {
  it("defaults to the 30-day preset ending today", () => {
    expect(resolvePeriod({}, T)).toMatchObject({ days: 30, preset: 30, to: T, from: "2026-09-21" });
  });
  it("accepts presets 7/14/30/90", () => {
    expect(resolvePeriod({ period: "14" }, T).preset).toBe(14);
    expect(resolvePeriod({ period: "90" }, T)).toMatchObject({ days: 90, from: "2026-07-23" });
  });
  it("accepts a custom range, swapping reversed bounds", () => {
    expect(resolvePeriod({ from: "2026-10-18", to: "2026-10-10" }, T)).toMatchObject({ from: "2026-10-10", to: "2026-10-18", days: 9, preset: null });
  });
  it("clamps the end to today and allows a single day", () => {
    expect(resolvePeriod({ from: "2026-10-20", to: "2026-10-25" }, T)).toMatchObject({ to: T, days: 1 });
  });
  it("falls back to the default when a bound is malformed", () => {
    expect(resolvePeriod({ from: "bad", to: "2026-10-20" }, T).preset).toBe(30);
    expect(resolvePeriod({ period: "12" }, T).preset).toBe(30);
  });
});

describe("resolvePeriod hardening", () => {
  const T = "2026-10-20";
  it("rejects impossible calendar dates instead of rolling them over", () => {
    expect(resolvePeriod({ from: "2026-02-31", to: "2026-03-02" }, T).preset).toBe(30);
    expect(resolvePeriod({ from: "0050-01-01", to: T }, T).preset).toBe(30);
  });
  it("caps a custom range at 365 days", () => {
    const r = resolvePeriod({ from: "1990-01-01", to: T }, T);
    expect(r.days).toBe(365);
    expect(r.from).toBe("2025-10-21");
    expect(r.preset).toBeNull();
  });
});
