import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts } from "@/lib/db/schema";
import { syncSegment } from "@/lib/sync/segment";
import type { SyncResult } from "@/lib/sync/run";

describe("syncSegment", () => {
  let db: TestDb;
  const calls: string[] = [];
  const runner = async (accountId: string): Promise<SyncResult> => {
    calls.push(accountId);
    return { accountId, postsUpserted: 1, snapshotsWritten: 0, status: "ok" };
  };
  beforeEach(async () => {
    calls.length = 0;
    ({ db } = await makeTestDb());
    await db.insert(accounts).values([
      { platform: "telegram", handle: "tg", language: "ru", status: "active" },
      { platform: "instagram", handle: "ig-ru", language: "ru", status: "active", externalUserId: "1", tokenEnc: "x" },
      { platform: "threads", handle: "th-en", language: "en", status: "active", externalUserId: "2", tokenEnc: "x" },
      { platform: "instagram", handle: "ig-paused", language: "ru", status: "paused", externalUserId: "3", tokenEnc: "x" },
      { platform: "linkedin", handle: "li", language: "en", status: "active" },
    ]);
  });

  it("syncs only active API accounts of the segment and explains every skip", async () => {
    const r = await syncSegment(db, "ru", { runner });
    expect(r.results.map((x) => x.status)).toEqual(["ok"]);
    expect(calls).toHaveLength(1);
    const reasons = Object.fromEntries(r.skipped.map((s) => [s.platform + ":" + s.reason, true]));
    expect(reasons["telegram:worker"]).toBe(true);
    expect(reasons["instagram:paused"]).toBe(true);
    expect(r.skipped.some((s) => s.platform === "threads")).toBe(false);
  });

  it("without a segment syncs every active API account", async () => {
    const r = await syncSegment(db, undefined, { runner });
    expect(r.results).toHaveLength(2);
    expect(r.skipped.map((s) => s.reason).sort()).toEqual(["no_api", "paused", "worker"]);
  });
});
