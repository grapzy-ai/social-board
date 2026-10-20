import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, accountMetricsDaily, goals, posts, postMetricsSnapshots, benchmarks, signals } from "@/lib/db/schema";
import { getOverview } from "@/lib/queries/overview";
import { resolvePeriod } from "@/lib/ui/period";

const spec = (days: 7 | 14 | 30 | 90) => resolvePeriod({ period: String(days) }, "2026-10-19");

const NOW = new Date("2026-10-19T10:00:00Z"); // 13:00 Chisinau → today = 2026-10-19

describe("getOverview", () => {
  let db: TestDb;
  let accountId: string;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
    const [a] = await db.insert(accounts).values({ platform: "threads", handle: "vadim.bordian" }).returning();
    accountId = a.id;
    await db.insert(accountMetricsDaily).values([
      { accountId, date: "2026-10-17", followers: 100 },
      { accountId, date: "2026-10-18", followers: 110 },
      { accountId, date: "2026-10-19", followers: 125 },
    ]);
  });

  it("computes deltas, cumulative growth and goal progress", async () => {
    await db.insert(goals).values({ accountId, month: "2026-10-01", target: 1000 });
    const o = await getOverview(db, spec(7), NOW);
    expect(o.accounts).toHaveLength(1);
    const c = o.accounts[0];
    expect(c.followers).toBe(125);
    expect(c.deltaYesterday).toBe(10);
    expect(c.deltaToday).toBe(15);
    expect(c.goal).toEqual({ target: 1000, progressPct: 12.5 });
    const series = o.growth.map((g) => g[accountId]);
    expect(series).toEqual([0, 10, 25]);
    expect(o.growth[0].date).toBe("2026-10-17");
  });

  it("returns goal null when no goal is set and sums period views from latest snapshots", async () => {
    const [p1] = await db.insert(posts).values({ accountId, externalId: "a", format: "thread", publishedAt: new Date("2026-10-15T10:00:00Z") }).returning();
    await db.insert(postMetricsSnapshots).values([
      { postId: p1.id, dayIndex: 1, views: 100, likes: 2, comments: 1 },
      { postId: p1.id, dayIndex: 3, views: 400, likes: 5, comments: 2 },
    ]);
    const o = await getOverview(db, spec(30), NOW);
    expect(o.accounts[0].goal).toBeNull();
    expect(o.accounts[0].periodViews).toBe(400);
    expect(o.accounts[0].periodReactions).toBe(7);
  });

  it("excludes posts published before the period", async () => {
    const [old] = await db.insert(posts).values({ accountId, externalId: "old", format: "thread", publishedAt: new Date("2026-09-01T10:00:00Z") }).returning();
    await db.insert(postMetricsSnapshots).values({ postId: old.id, dayIndex: 11, views: 9999 });
    const o = await getOverview(db, spec(7), NOW);
    expect(o.accounts[0].periodViews).toBe(0);
  });

  it("filters accounts by language when a segment is set and returns empty for a segment without accounts", async () => {
    const [en] = await db.insert(accounts).values({ platform: "instagram", handle: "vadim.en", language: "en" }).returning();
    await db.insert(accountMetricsDaily).values({ accountId: en.id, date: "2026-10-19", followers: 5 });
    const ru = await getOverview(db, spec(7), NOW, "ru");
    expect(ru.accounts.map((a) => a.platform)).toEqual(["threads"]);
    const enOnly = await getOverview(db, spec(7), NOW, "en");
    expect(enOnly.accounts.map((a) => a.platform)).toEqual(["instagram"]);
    const all = await getOverview(db, spec(7), NOW);
    expect(all.accounts).toHaveLength(2);
    await db.delete(accounts).where(eq(accounts.id, en.id));
    const empty = await getOverview(db, spec(7), NOW, "en");
    expect(empty.accounts).toEqual([]);
    expect(empty.growth).toEqual([]);
  });

  describe("stage 2 additions", () => {
    it("builds a 7-day sparkline with null for missing days", async () => {
      // base fixture has 17, 18, 19 → add 13, 14, 15 (gap at 16)
      await db.insert(accountMetricsDaily).values([
        { accountId, date: "2026-10-13", followers: 90 },
        { accountId, date: "2026-10-14", followers: 92 },
        { accountId, date: "2026-10-15", followers: 95 },
      ]);
      const o = await getOverview(db, spec(7), NOW);
      const c = o.accounts[0];
      expect(c.spark).toHaveLength(7);
      expect(c.spark[3]).toBeNull(); // 2026-10-16
      expect(c.spark[0]).toBe(0);
      expect(c.spark[6]).toBe(35); // 125 - 90
    });

    it("computes goal pace: need per day, actual per day over 7 days, forecast", async () => {
      await db.insert(goals).values({ accountId, month: "2026-10-01", target: 400 });
      await db.insert(accountMetricsDaily).values({ accountId, date: "2026-10-12", followers: 111 });
      const o = await getOverview(db, spec(7), NOW); // today 19.10 → 12 days left (20..31)
      const p = o.accounts[0].pace!;
      expect(p.needPerDay).toBeCloseTo((400 - 125) / 12, 2);
      expect(p.actualPerDay7).toBeCloseTo((125 - 111) / 7, 2);
      expect(p.forecastEnd).toBe(Math.round(125 + ((125 - 111) / 7) * 12));
    });

    it("pace is null without a goal", async () => {
      const o = await getOverview(db, spec(7), NOW);
      expect(o.accounts[0].pace).toBeNull();
    });

    it("lists top and anti-top posts of the period by multiplier, excluding posts outside it", async () => {
      await db.insert(benchmarks).values({ accountId, format: "thread", medianViews: 100, sampleSize: 6, computedOn: "2026-10-19" });
      const mk = async (ext: string, when: string, views: number) => {
        const [p] = await db.insert(posts).values({ accountId, externalId: ext, format: "thread", publishedAt: new Date(when), text: ext }).returning();
        await db.insert(postMetricsSnapshots).values({ postId: p.id, dayIndex: 11, views });
      };
      await mk("hot", "2026-10-15T10:00:00Z", 320);
      await mk("cold", "2026-10-16T10:00:00Z", 40);
      await mk("mid", "2026-10-17T10:00:00Z", 100);
      await mk("outside", "2026-09-01T10:00:00Z", 9000);
      const o = await getOverview(db, spec(7), NOW);
      expect(o.top[0]).toMatchObject({ text: "hot", multiplier: 3.2 });
      expect(o.bottom[0]).toMatchObject({ text: "cold", multiplier: 0.4 });
      expect([...o.top, ...o.bottom].some((p) => p.text === "outside")).toBe(false);
    });

    it("returns the latest new signals of the segment only", async () => {
      const [en] = await db.insert(accounts).values({ platform: "instagram", handle: "en", language: "en" }).returning();
      await db.insert(signals).values([
        { accountId, type: "token_expiring", payload: {} },
        { accountId, type: "day11_due", payload: {} },
        { accountId, type: "week_drop", payload: {}, status: "sent" },
        { accountId: en.id, type: "token_expired", payload: {} },
      ]);
      const ru = await getOverview(db, spec(7), NOW, "ru");
      expect(ru.signals).toHaveLength(2);
      expect(ru.signals[0].handle).toBe("vadim.bordian");
      const all = await getOverview(db, spec(7), NOW);
      expect(all.signals).toHaveLength(3);
    });
  });
});
