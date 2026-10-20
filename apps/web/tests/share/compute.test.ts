import { describe, it, expect } from "vitest";
import { computeShare, type ShareInput } from "@/lib/share/compute";

const acc = (id: string, platform: "telegram" | "instagram", language: "ru" | "en" = "ru") => ({ id, platform, language, handle: id });

describe("computeShare", () => {
  it("computes deltas, percentages, totals and a stacked cumulative series (gaps tolerated)", () => {
    const input: ShareInput = {
      accounts: [acc("tg", "telegram"), acc("ig", "instagram")],
      daily: [
        { accountId: "tg", date: "2026-10-01", followers: 100 },
        { accountId: "tg", date: "2026-10-02", followers: 104 },
        { accountId: "tg", date: "2026-10-04", followers: 110 },
        { accountId: "tg", date: "2026-10-05", followers: 120 },
        { accountId: "ig", date: "2026-10-01", followers: 500 },
        { accountId: "ig", date: "2026-10-02", followers: 505 },
        { accountId: "ig", date: "2026-10-03", followers: 510 },
        { accountId: "ig", date: "2026-10-04", followers: 520 },
        { accountId: "ig", date: "2026-10-05", followers: 550 },
      ],
      views: [{ accountId: "tg", views: 1200 }, { accountId: "ig", views: 8800 }],
      from: "2026-10-01",
      to: "2026-10-05",
    };
    const s = computeShare(input);
    expect(s.days).toBe(5);
    expect(s.hasData).toBe(true);
    expect(s.perPlatform.map((p) => [p.platform, p.delta, p.pct])).toEqual([["telegram", 20, 20], ["instagram", 50, 10]]);
    expect(s.totalDelta).toBe(70);
    expect(s.totalPct).toBe(11.7); // 70 / 600
    expect(s.totalViews).toBe(10000);
    expect(s.series).toHaveLength(5);
    expect(s.series[1].stacked).toEqual([4, 9]); // tg +4, ig +5 → stacked 4, 9
    expect(s.series[2].stacked).toEqual([4, 14]); // tg gap carries 4; ig +10
    expect(s.series[4].stacked).toEqual([20, 70]);
    expect(s.perPlatform[0].color).toMatch(/^#/);
  });

  it("single-day range → no deltas, no percent, hasData false", () => {
    const s = computeShare({ accounts: [acc("tg", "telegram")], daily: [{ accountId: "tg", date: "2026-10-05", followers: 120 }], views: [], from: "2026-10-05", to: "2026-10-05" });
    expect(s.days).toBe(1);
    expect(s.perPlatform[0]).toMatchObject({ delta: null, pct: null });
    expect(s.totalDelta).toBeNull();
    expect(s.totalPct).toBeNull();
    expect(s.hasData).toBe(false);
  });

  it("first value 0 → pct null, delta kept", () => {
    const s = computeShare({ accounts: [acc("ig", "instagram", "en")], daily: [{ accountId: "ig", date: "2026-10-01", followers: 0 }, { accountId: "ig", date: "2026-10-03", followers: 12 }], views: [], from: "2026-10-01", to: "2026-10-03" });
    expect(s.perPlatform[0]).toMatchObject({ delta: 12, pct: null });
    expect(s.totalPct).toBeNull();
  });
});
