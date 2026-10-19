import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, posts, postMetricsSnapshots, benchmarks } from "@/lib/db/schema";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const runSyncMock = vi.fn(async (accountId: string) => ({ accountId, postsUpserted: 1, snapshotsWritten: 0, status: "ok" as const }));
vi.mock("@/lib/sync/run", () => ({ runSync: (id: string) => runSyncMock(id) }));

import { POST as syncPOST } from "@/app/api/cron/sync/route";
import { POST as benchPOST } from "@/app/api/cron/benchmarks/route";
import { GET as healthGET } from "@/app/api/health/route";

const req = (auth?: string) => new Request("http://x/api/cron/sync", { method: "POST", headers: auth ? { Authorization: auth } : {} });

describe("cron + health routes", () => {
  beforeEach(async () => {
    process.env.CRON_SECRET = "s3cret";
    ({ db } = await makeTestDb());
    runSyncMock.mockClear();
  });

  it("rejects sync without the bearer secret", async () => {
    const res = await syncPOST(req());
    expect(res.status).toBe(401);
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("runs sync for every active threads/instagram account", async () => {
    await db.insert(accounts).values([
      { platform: "threads", handle: "a", externalUserId: "1", tokenEnc: "x" },
      { platform: "instagram", handle: "b", externalUserId: "2", tokenEnc: "x" },
      { platform: "telegram", handle: "c" },
      { platform: "instagram", handle: "d", externalUserId: "3", tokenEnc: "x", status: "paused" },
    ]);
    const res = await syncPOST(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(runSyncMock).toHaveBeenCalledTimes(2);
  });

  it("recomputes benchmarks per account+format from day-11 snapshots (null under 5 samples, provisional fallback)", async () => {
    const [acc] = await db.insert(accounts).values({ platform: "instagram", handle: "a", externalUserId: "1", tokenEnc: "x" }).returning();
    const now = new Date("2026-10-19T10:00:00Z");
    const mk = async (i: number, format: "reel" | "image", ageDays: number, views: number, withDay11: boolean) => {
      const [p] = await db
        .insert(posts)
        .values({ accountId: acc.id, externalId: `${format}${i}`, format, publishedAt: new Date(now.getTime() - ageDays * 86_400_000) })
        .returning();
      await db.insert(postMetricsSnapshots).values({ postId: p.id, dayIndex: withDay11 ? 11 : 1, views, capturedAt: now });
    };
    // 6 reels with proper day-11 snapshots
    for (let i = 0; i < 6; i++) await mk(i, "reel", 20, [100, 200, 300, 400, 1000, 500][i], true);
    // 5 images, old enough but only day-1 snapshots -> provisional benchmark from latest snapshot
    for (let i = 0; i < 5; i++) await mk(i, "image", 30, 50 + i * 10, false);
    const res = await benchPOST(new Request("http://x/api/cron/benchmarks", { method: "POST", headers: { Authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    const rows = await db.select().from(benchmarks);
    const reel = rows.find((r) => r.format === "reel")!;
    const image = rows.find((r) => r.format === "image")!;
    expect(reel.medianViews).toBe(350);
    expect(reel.provisional).toBe(false);
    expect(reel.sampleSize).toBe(6);
    expect(image.medianViews).toBe(70);
    expect(image.provisional).toBe(true);
  });

  it("health is 200 with fresh syncs and 503 when an active account is stale", async () => {
    const fresh = new Date();
    await db.insert(accounts).values({ platform: "threads", handle: "a", externalUserId: "1", tokenEnc: "x", lastOkSyncAt: fresh });
    expect((await healthGET()).status).toBe(200);
    await db.insert(accounts).values({ platform: "instagram", handle: "b", externalUserId: "2", tokenEnc: "x", lastOkSyncAt: new Date(Date.now() - 14 * 3600_000) });
    const res = await healthGET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.accounts).toHaveLength(2);
  });
});
