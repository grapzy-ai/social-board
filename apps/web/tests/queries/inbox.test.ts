import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testdb";
import { inboxItems } from "@/lib/db/schema";
import { getInboxItem, listInbox } from "@/lib/queries/inbox";

describe("inbox queries", () => {
  it("lists open items newest first, filters by language and status", async () => {
    const { db } = await makeTestDb();
    const t0 = new Date("2026-10-20T08:00:00Z");
    await db.insert(inboxItems).values([
      { source: "bot", kind: "text", text: "первая", status: "new", language: "ru", createdAt: t0 },
      { source: "bot", kind: "text", text: "вторая", status: "sorted", language: "ru", createdAt: new Date(t0.getTime() + 1000) },
      { source: "manual", kind: "link", text: "english", status: "sorted", language: "en", createdAt: new Date(t0.getTime() + 2000) },
      { source: "bot", kind: "text", text: "архив", status: "archived", language: "ru", createdAt: new Date(t0.getTime() + 3000) },
      { source: "bot", kind: "text", text: "использовано", status: "used", language: "ru", createdAt: new Date(t0.getTime() + 4000) },
      { source: "bot", kind: "voice", text: null, status: "new", language: null, createdAt: new Date(t0.getTime() - 1000) },
    ]);
    const open = await listInbox(db, { status: "open" });
    expect(open.map((i) => i.text)).toEqual(["english", "вторая", "первая", null]);
    // an unsorted item has no language yet and must stay visible in a language segment
    expect((await listInbox(db, { status: "open", language: "ru" })).map((i) => i.text)).toEqual(["вторая", "первая", null]);
    expect((await listInbox(db, { status: "open", language: "en" })).map((i) => i.text)).toEqual(["english", null]);
    expect((await listInbox(db, { status: "archived" })).map((i) => i.text)).toEqual(["архив"]);
    expect((await listInbox(db, { status: "used" })).map((i) => i.text)).toEqual(["использовано"]);
    const one = await getInboxItem(db, open[0].id);
    expect(one?.text).toBe("english");
    expect(await getInboxItem(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
