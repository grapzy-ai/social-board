import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, posts, postMetricsSnapshots, accountMetricsDaily, signals, syncRuns } from "@/lib/db/schema";
import { runSync } from "@/lib/sync/run";
import type { Adapter, NormalizedPost, NormalizedPostMetrics } from "@/lib/adapters/types";
import { EMPTY_METRICS } from "@/lib/adapters/types";
import { MetaApiError } from "@/lib/adapters/meta-http";
import { encryptToken } from "@/lib/crypto";

const NOW = new Date("2026-10-19T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

class FakeAdapter implements Adapter {
  constructor(private postsList: NormalizedPost[], private failAuth = false) {}
  async listPosts(): Promise<NormalizedPost[]> {
    if (this.failAuth) throw new MetaApiError("Invalid OAuth access token", 401, 190);
    return this.postsList;
  }
  async postMetrics(externalId: string): Promise<NormalizedPostMetrics> {
    return { ...EMPTY_METRICS, views: externalId === "p1" ? 100 : 2000, likes: 3 };
  }
  async accountMetrics() {
    return { followers: 700, profileViews: 10, reach: null };
  }
  async refreshToken() {
    return { token: "t", expiresAt: NOW };
  }
}

const twoPosts: NormalizedPost[] = [
  { externalId: "p1", format: "reel", publishedAt: daysAgo(1), text: "a", mediaUrl: null, permalink: null },
  { externalId: "p2", format: "reel", publishedAt: daysAgo(11), text: "b", mediaUrl: null, permalink: null },
];

describe("runSync", () => {
  let db: TestDb;
  let accountId: string;

  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  });

  beforeEach(async () => {
    ({ db } = await makeTestDb());
    const [a] = await db
      .insert(accounts)
      .values({ platform: "instagram", handle: "vadim.bordian", externalUserId: "ig1", tokenEnc: encryptToken("tok") })
      .returning();
    accountId = a.id;
  });

  it("first run upserts posts, writes day-1 and day-11 snapshots and today's account metrics", async () => {
    const r = await runSync(accountId, { db, now: NOW, adapter: new FakeAdapter(twoPosts) });
    expect(r).toMatchObject({ status: "ok", postsUpserted: 2, snapshotsWritten: 2 });
    const snaps = await db.select().from(postMetricsSnapshots);
    expect(snaps.map((s) => s.dayIndex).sort()).toEqual([1, 11]);
    const daily = await db.select().from(accountMetricsDaily).where(eq(accountMetricsDaily.accountId, accountId));
    expect(daily).toHaveLength(1);
    expect(daily[0].followers).toBe(700);
    expect(daily[0].date).toBe("2026-10-19");
    const runs = await db.select().from(syncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("ok");
  });

  it("second run at the same time upserts the same posts and writes no new snapshots", async () => {
    await runSync(accountId, { db, now: NOW, adapter: new FakeAdapter(twoPosts) });
    const r = await runSync(accountId, { db, now: NOW, adapter: new FakeAdapter(twoPosts) });
    expect(r.postsUpserted).toBe(2);
    expect(r.snapshotsWritten).toBe(0);
    expect(await db.select().from(posts)).toHaveLength(2);
    expect(await db.select().from(postMetricsSnapshots)).toHaveLength(2);
  });

  it("passes the post format to the adapter when fetching metrics", async () => {
    const seen: (string | undefined)[] = [];
    const adapter = new FakeAdapter(twoPosts);
    adapter.postMetrics = async (id: string, format?: string) => {
      seen.push(format);
      return { ...EMPTY_METRICS, views: 1 };
    };
    await runSync(accountId, { db, now: NOW, adapter });
    expect(seen).toEqual(["reel", "reel"]);
  });

  it("on an auth error records an error run, flags the account and raises a token_expired signal, keeping earlier data", async () => {
    await runSync(accountId, { db, now: NOW, adapter: new FakeAdapter(twoPosts) });
    const r = await runSync(accountId, { db, now: NOW, adapter: new FakeAdapter([], true) });
    expect(r.status).toBe("error");
    expect(await db.select().from(posts)).toHaveLength(2);
    const sig = await db.select().from(signals);
    expect(sig).toHaveLength(1);
    expect(sig[0].type).toBe("token_expired");
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    expect(acc.status).toBe("token_invalid");
    const runs = await db.select().from(syncRuns);
    expect(runs.map((x) => x.status)).toEqual(["ok", "error"]);
  });
});
