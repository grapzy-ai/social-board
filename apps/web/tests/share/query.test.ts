import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testdb";
import { accounts, accountMetricsDaily, posts, postMetricsSnapshots } from "@/lib/db/schema";
import { getShareStats } from "@/lib/share/query";
import { resolvePeriod } from "@/lib/ui/period";

describe("getShareStats", () => {
  it("filters by segment language and sums the latest views of posts in range", async () => {
    const { db } = await makeTestDb();
    const [tg] = await db.insert(accounts).values({ platform: "telegram", handle: "vadimbordian", language: "ru" }).returning();
    const [en] = await db.insert(accounts).values({ platform: "instagram", handle: "vadim.en", language: "en" }).returning();
    await db.insert(accountMetricsDaily).values([
      { accountId: tg.id, date: "2026-10-18", followers: 340 },
      { accountId: tg.id, date: "2026-10-20", followers: 345 },
      { accountId: en.id, date: "2026-10-18", followers: 10 },
      { accountId: en.id, date: "2026-10-20", followers: 30 },
    ]);
    const [p] = await db.insert(posts).values({ accountId: tg.id, externalId: "1", format: "tg_post", publishedAt: new Date("2026-10-19T10:00:00Z") }).returning();
    await db.insert(postMetricsSnapshots).values([{ postId: p.id, dayIndex: 1, views: 100 }, { postId: p.id, dayIndex: 3, views: 400 }]);
    const spec = resolvePeriod({ period: "7" }, "2026-10-20");
    const ru = await getShareStats(db, "ru", spec);
    expect(ru.handle).toBe("vadimbordian");
    expect(ru.perPlatform.map((x) => x.platform)).toEqual(["telegram"]);
    expect(ru.totalDelta).toBe(5);
    expect(ru.totalViews).toBe(400);
    const all = await getShareStats(db, undefined, spec);
    expect(all.perPlatform).toHaveLength(2);
    expect(all.totalDelta).toBe(25);
    expect(all.handle).toBe("vadim.bordian");
  });
});
