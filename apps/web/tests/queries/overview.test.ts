import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, accountMetricsDaily, goals, posts, postMetricsSnapshots } from "@/lib/db/schema";
import { getOverview } from "@/lib/queries/overview";

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
    const o = await getOverview(db, 7, NOW);
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
    const o = await getOverview(db, 30, NOW);
    expect(o.accounts[0].goal).toBeNull();
    expect(o.accounts[0].periodViews).toBe(400);
    expect(o.accounts[0].periodReactions).toBe(7);
  });

  it("excludes posts published before the period", async () => {
    const [old] = await db.insert(posts).values({ accountId, externalId: "old", format: "thread", publishedAt: new Date("2026-09-01T10:00:00Z") }).returning();
    await db.insert(postMetricsSnapshots).values({ postId: old.id, dayIndex: 11, views: 9999 });
    const o = await getOverview(db, 7, NOW);
    expect(o.accounts[0].periodViews).toBe(0);
  });
});
