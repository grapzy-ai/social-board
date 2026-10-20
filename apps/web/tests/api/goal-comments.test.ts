import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, signals } from "@/lib/db/schema";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const notifyMock = vi.fn<(t: string) => Promise<{ delivered: number; failed: number }>>();
vi.mock("@/lib/telegram/notify", () => ({ notifyAll: (t: string) => notifyMock(t) }));
vi.mock("@/lib/claude/goal-comment", () => ({ generateGoalComment: async () => null }));

import { POST } from "@/app/api/cron/goal-comments/route";

const req = () => new Request("http://x/api/cron/goal-comments", { method: "POST", headers: { Authorization: "Bearer s3cret" } });

describe("goal-comments signal digest", () => {
  beforeEach(async () => {
    process.env.CRON_SECRET = "s3cret";
    ({ db } = await makeTestDb());
    notifyMock.mockReset();
  });
  it("keeps signals `new` when the bot delivered to nobody", async () => {
    const [a] = await db.insert(accounts).values({ platform: "threads", handle: "vadimbordian", externalUserId: "1" }).returning();
    await db.insert(signals).values({ accountId: a.id, type: "token_expired", payload: {} });
    notifyMock.mockResolvedValue({ delivered: 0, failed: 2 });
    const res = await POST(req());
    expect((await res.json()).signalsSent).toBe(0);
    expect((await db.select().from(signals))[0].status).toBe("new");
  });
  it("names the account handle in the digest even when that account has no goal, and marks sent on delivery", async () => {
    const [a] = await db.insert(accounts).values({ platform: "threads", handle: "vadimbordian", externalUserId: "1" }).returning();
    await db.insert(signals).values({ accountId: a.id, type: "sync_failing", payload: {} });
    notifyMock.mockResolvedValue({ delivered: 1, failed: 0 });
    await POST(req());
    expect(notifyMock.mock.calls[0][0]).toContain("vadimbordian");
    expect((await db.select().from(signals))[0].status).toBe("sent");
  });
});
