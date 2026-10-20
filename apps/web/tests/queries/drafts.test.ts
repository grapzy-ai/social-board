import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testdb";
import { drafts, inboxItems } from "@/lib/db/schema";
import { getDraft, listDrafts } from "@/lib/queries/drafts";

describe("drafts queries", () => {
  it("filters by status, type, inbox item and language; newest first", async () => {
    const { db } = await makeTestDb();
    const [a] = await db.insert(inboxItems).values({ source: "bot", kind: "text", text: "a" }).returning();
    const [b] = await db.insert(inboxItems).values({ source: "bot", kind: "text", text: "b" }).returning();
    const t0 = Date.now();
    await db.insert(drafts).values([
      { inboxItemId: a.id, type: "reel", title: "r1", body: { script: "s", hooks: [], cover: "c" }, status: "draft", createdAt: new Date(t0) },
      { inboxItemId: a.id, type: "threads", title: "t1", body: { text: "x" }, status: "ready", createdAt: new Date(t0 + 1000) },
      { inboxItemId: b.id, type: "tg", title: "g1", body: { text: "y" }, status: "approved", language: "en", createdAt: new Date(t0 + 2000) },
    ]);
    expect((await listDrafts(db, {})).map((d) => d.title)).toEqual(["g1", "t1", "r1"]);
    expect((await listDrafts(db, { status: "ready" })).map((d) => d.title)).toEqual(["t1"]);
    expect((await listDrafts(db, { type: "reel" })).map((d) => d.title)).toEqual(["r1"]);
    expect((await listDrafts(db, { inboxItemId: a.id })).map((d) => d.title)).toEqual(["t1", "r1"]);
    expect((await listDrafts(db, { language: "en" })).map((d) => d.title)).toEqual(["g1"]);
    const one = await getDraft(db, (await listDrafts(db, { type: "tg" }))[0].id);
    expect(one?.body).toEqual({ text: "y" });
  });
});
