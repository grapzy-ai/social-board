import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, signals } from "@/lib/db/schema";
import { refreshIfNeeded, addAccount } from "@/lib/sync/tokens";
import { decryptToken } from "@/lib/crypto";
import type { Adapter } from "@/lib/adapters/types";

const NOW = new Date("2026-10-19T10:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const okAdapter = (): Adapter => ({
  listPosts: async () => [],
  postMetrics: async () => ({ views: null, likes: null, comments: null, saves: null, reposts: null, shares: null, clicks: null, reach: null, avgWatchTimeSec: null }),
  accountMetrics: async () => ({ followers: null, profileViews: null, reach: null }),
  refreshToken: async () => ({ token: "NEW", expiresAt: days(60) }),
});
const failingAdapter = (): Adapter => ({ ...okAdapter(), refreshToken: async () => { throw new Error("boom"); } });

describe("tokens", () => {
  let db: TestDb;
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString("base64");
  });
  beforeEach(async () => {
    ({ db } = await makeTestDb());
  });

  it("addAccount stores the token encrypted and returns the account", async () => {
    const acc = await addAccount(db, { platform: "instagram", handle: "vadim.bordian", externalUserId: "ig1", language: "ru", role: "focus", token: "PLAIN", expiresAt: days(60) });
    expect(acc.tokenEnc).not.toContain("PLAIN");
    expect(decryptToken(acc.tokenEnc!)).toBe("PLAIN");
    // upsert by (platform, handle)
    const again = await addAccount(db, { platform: "instagram", handle: "vadim.bordian", externalUserId: "ig1", language: "ru", role: "focus", token: "PLAIN2", expiresAt: days(60) });
    expect(again.id).toBe(acc.id);
    expect(decryptToken(again.tokenEnc!)).toBe("PLAIN2");
  });

  it("skips refresh when more than 10 days remain", async () => {
    const acc = await addAccount(db, { platform: "threads", handle: "a", externalUserId: "1", language: "ru", role: "focus", token: "T", expiresAt: days(30) });
    expect(await refreshIfNeeded(db, acc, { now: NOW, adapter: okAdapter() })).toBe("skipped");
  });

  it("refreshes when under 10 days remain and stores the new token", async () => {
    const acc = await addAccount(db, { platform: "threads", handle: "a", externalUserId: "1", language: "ru", role: "focus", token: "T", expiresAt: days(5) });
    expect(await refreshIfNeeded(db, acc, { now: NOW, adapter: okAdapter() })).toBe("refreshed");
    const [row] = await db.select().from(accounts).where(eq(accounts.id, acc.id));
    expect(row.tokenEnc).not.toBe(acc.tokenEnc);
    expect(decryptToken(row.tokenEnc!)).toBe("NEW");
    expect(row.tokenExpiresAt!.getTime()).toBe(days(60).getTime());
  });

  it("records a token_expiring signal when refresh fails", async () => {
    const acc = await addAccount(db, { platform: "threads", handle: "a", externalUserId: "1", language: "ru", role: "focus", token: "T", expiresAt: days(5) });
    expect(await refreshIfNeeded(db, acc, { now: NOW, adapter: failingAdapter() })).toBe("failed");
    const sig = await db.select().from(signals);
    expect(sig).toHaveLength(1);
    expect(sig[0].type).toBe("token_expiring");
  });
});
