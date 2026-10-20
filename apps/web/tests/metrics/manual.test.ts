import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/testdb";
import { accounts, accountMetricsDaily, manualMetrics } from "@/lib/db/schema";
import { recordManualMetrics } from "@/lib/metrics/manual";

describe("recordManualMetrics", () => {
  it("upserts the manual row and mirrors followers into the daily series", async () => {
    const { db } = await makeTestDb();
    const [li] = await db.insert(accounts).values({ platform: "linkedin", handle: "vadimbordian", language: "en" }).returning();
    const now = new Date("2026-10-20T09:00:00Z");
    await recordManualMetrics(db, { accountId: li.id, date: "2026-10-20", followers: 1200, views: 5400 }, now);
    expect(await db.select().from(manualMetrics)).toHaveLength(1);
    let daily = await db.select().from(accountMetricsDaily).where(eq(accountMetricsDaily.accountId, li.id));
    expect(daily).toHaveLength(1);
    expect(daily[0].followers).toBe(1200);

    await recordManualMetrics(db, { accountId: li.id, date: "2026-10-20", followers: 1250, views: null, note: "после поста" }, now);
    const manual = await db.select().from(manualMetrics);
    expect(manual).toHaveLength(1);
    expect(manual[0].followers).toBe(1250);
    expect(manual[0].note).toBe("после поста");
    daily = await db.select().from(accountMetricsDaily).where(eq(accountMetricsDaily.accountId, li.id));
    expect(daily).toHaveLength(1);
    expect(daily[0].followers).toBe(1250);

    const [acc] = await db.select().from(accounts).where(eq(accounts.id, li.id));
    expect(acc.lastOkSyncAt).not.toBeNull();
  });
});
