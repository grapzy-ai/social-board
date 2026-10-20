import { describe, it, expect } from "vitest";
import { chisinauDate, dayIndex, shouldSnapshot, SNAPSHOT_DAYS } from "@/lib/time";

describe("chisinauDate", () => {
  it("formats a UTC instant as the local Chisinau calendar date", () => {
    // 2026-10-19T20:30Z is 23:30 in Chisinau (UTC+3)
    expect(chisinauDate(new Date("2026-10-19T20:30:00Z"))).toBe("2026-10-19");
    // 2026-10-19T21:30Z is 00:30 next day in Chisinau
    expect(chisinauDate(new Date("2026-10-19T21:30:00Z"))).toBe("2026-10-20");
  });
});

describe("dayIndex", () => {
  it("counts whole local days between publish date and now", () => {
    const published = new Date("2026-10-19T20:30:00Z"); // 23:30 local
    const now = new Date("2026-10-20T05:00:00Z"); // 08:00 next local day
    expect(dayIndex(published, now)).toBe(1);
  });
  it("is 0 on the publish day", () => {
    const x = new Date("2026-10-19T10:00:00Z");
    expect(dayIndex(x, x)).toBe(0);
  });
});

describe("shouldSnapshot", () => {
  it("exposes the fixed snapshot days", () => {
    expect(SNAPSHOT_DAYS).toEqual([1, 3, 7, 11, 30]);
  });
  it("snapshots a listed day that has no snapshot yet", () => {
    expect(shouldSnapshot(11, [1, 3, 7])).toBe(true);
  });
  it("does not snapshot a listed day twice", () => {
    expect(shouldSnapshot(11, [1, 3, 7, 11])).toBe(false);
  });
  it("after day 30 snapshots every 7th day", () => {
    expect(shouldSnapshot(37, [30])).toBe(true);
    expect(shouldSnapshot(36, [30])).toBe(false);
  });
  it("never snapshots unlisted early days", () => {
    expect(shouldSnapshot(2, [1])).toBe(false);
    expect(shouldSnapshot(0, [])).toBe(false);
  });
});

describe("chisinauDayBounds", () => {
  it("uses the real offset on both sides of the October DST change", async () => {
    const { chisinauDayBounds } = await import("@/lib/time");
    const summer = chisinauDayBounds("2026-10-20"); // UTC+3
    expect(summer.start.toISOString()).toBe("2026-10-19T21:00:00.000Z");
    expect(summer.end.toISOString()).toBe("2026-10-20T20:59:59.999Z");
    const winter = chisinauDayBounds("2026-10-26"); // UTC+2
    expect(winter.start.toISOString()).toBe("2026-10-25T22:00:00.000Z");
    expect(winter.end.toISOString()).toBe("2026-10-26T21:59:59.999Z");
  });
});
