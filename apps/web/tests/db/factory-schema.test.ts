import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/testdb";
import { inboxItems, drafts } from "@/lib/db/schema";

describe("0006 factory schema", () => {
  it("creates inbox_items and drafts with defaults and the tg dedupe index", async () => {
    const { db } = await makeTestDb();
    const [item] = await db.insert(inboxItems).values({ source: "bot", kind: "text", tgChatId: "1", tgMessageId: 10, text: "идея" }).returning();
    expect(item.status).toBe("new");
    expect(item.tags).toBeNull();
    await expect(db.insert(inboxItems).values({ source: "bot", kind: "text", tgChatId: "1", tgMessageId: 10, text: "дубль" })).rejects.toThrow();
    const [d] = await db.insert(drafts).values({ inboxItemId: item.id, type: "threads", title: "t", body: { text: "x" } }).returning();
    expect(d.status).toBe("draft");
    expect(d.language).toBe("ru");
    expect(d.body).toEqual({ text: "x" });
  });
});
