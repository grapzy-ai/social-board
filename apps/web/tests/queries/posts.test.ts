import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, posts, postMetricsSnapshots, benchmarks } from "@/lib/db/schema";
import { listPosts, getPost, setLabel } from "@/lib/queries/posts";

const NOW = new Date("2026-10-19T10:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("posts queries", () => {
  let db: TestDb;
  let accountId: string;
  beforeEach(async () => {
    ({ db } = await makeTestDb());
    const [a] = await db.insert(accounts).values({ platform: "instagram", handle: "vadim.bordian" }).returning();
    accountId = a.id;
  });

  async function post(externalId: string, format: "reel" | "carousel", ageDays: number, snaps: { dayIndex: number; views: number | null }[]) {
    const [p] = await db.insert(posts).values({ accountId, externalId, format, publishedAt: ago(ageDays), text: `t-${externalId}` }).returning();
    if (snaps.length) await db.insert(postMetricsSnapshots).values(snaps.map((s) => ({ postId: p.id, ...s, comments: 1, saves: 2 })));
    return p;
  }

  it("computes multiplier against the latest benchmark of the post's format", async () => {
    await post("r1", "reel", 20, [{ dayIndex: 11, views: 1200 }]);
    await db.insert(benchmarks).values({ accountId, format: "reel", medianViews: 470, sampleSize: 6, computedOn: "2026-10-18" });
    const rows = await listPosts(db, {}, "date");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day11Views: 1200, benchmark: 470, multiplier: 2.55, format: "reel", platform: "instagram" });
  });

  it("gives null benchmark and multiplier for a format with no benchmark", async () => {
    await post("c1", "carousel", 20, [{ dayIndex: 11, views: 300 }]);
    const rows = await listPosts(db, {}, "date");
    expect(rows[0].benchmark).toBeNull();
    expect(rows[0].multiplier).toBeNull();
  });

  it("sorts by multiplier descending with nulls last and filters by format", async () => {
    await db.insert(benchmarks).values({ accountId, format: "reel", medianViews: 100, sampleSize: 5 });
    await post("low", "reel", 20, [{ dayIndex: 11, views: 50 }]);
    await post("high", "reel", 20, [{ dayIndex: 11, views: 500 }]);
    await post("none", "reel", 2, [{ dayIndex: 1, views: 10 }]); // uses day-1 snapshot → multiplier 0.1
    await post("car", "carousel", 20, [{ dayIndex: 11, views: 999 }]); // no benchmark → null
    const rows = await listPosts(db, {}, "multiplier");
    expect(rows.map((r) => r.externalId)).toEqual(["high", "low", "none", "car"]);
    const reels = await listPosts(db, { format: "reel" }, "date");
    expect(reels.every((r) => r.format === "reel")).toBe(true);
    expect(reels).toHaveLength(3);
  });

  it("setLabel updates the label and getPost returns snapshots in day order", async () => {
    const p = await post("r1", "reel", 20, [{ dayIndex: 11, views: 1200 }, { dayIndex: 1, views: 100 }]);
    await setLabel(db, p.id, "hit");
    const rows = await listPosts(db, { label: "hit" }, "date");
    expect(rows).toHaveLength(1);
    const detail = await getPost(db, p.id);
    expect(detail?.label).toBe("hit");
    expect(detail?.snapshots.map((s) => s.dayIndex)).toEqual([1, 11]);
    await setLabel(db, p.id, null);
    expect((await getPost(db, p.id))?.label).toBeNull();
  });
});
