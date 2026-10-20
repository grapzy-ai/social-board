import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/testdb";
import { accounts, drafts, inboxItems } from "@/lib/db/schema";
import { createDraftsFromPackage } from "@/lib/drafts/create";
import { fixturePackage } from "../fixtures/package";

describe("createDraftsFromPackage", () => {
  it("creates 14 drafts linked to the inbox item and marks it used", async () => {
    const { db } = await makeTestDb();
    const [tg] = await db.insert(accounts).values({ platform: "telegram", handle: "vadimbordian", language: "ru" }).returning();
    const [item] = await db.insert(inboxItems).values({ source: "bot", kind: "text", text: "исходник", status: "sorted" }).returning();
    const rows = await createDraftsFromPackage(db, fixturePackage, { inboxItemId: item.id, language: "ru", telegramAccountId: tg.id });
    expect(rows).toHaveLength(14);
    const count = (t: string) => rows.filter((r) => r.type === t).length;
    expect([count("reel"), count("threads"), count("carousel"), count("story"), count("tg")]).toEqual([4, 5, 1, 3, 1]);
    const tgDraft = rows.find((r) => r.type === "tg")!;
    expect(tgDraft.accountId).toBe(tg.id);
    expect(tgDraft.body).toEqual({ text: fixturePackage.tg.text });
    expect(tgDraft.title).toBe("Мы посчитали");
    const reel = rows.find((r) => r.type === "reel")!;
    expect(reel.body).toMatchObject({ script: expect.any(String), hooks: ["Хук один", "Хук два", "Хук три"], cover: expect.any(String), angle: "teach" });
    const carousel = rows.find((r) => r.type === "carousel")!;
    expect(carousel.body).toEqual({ slides: fixturePackage.carousel.slides, caption: "подпись" });
    expect(rows.every((r) => r.inboxItemId === item.id && r.status === "draft" && r.language === "ru")).toBe(true);
    const [after] = await db.select().from(inboxItems).where(eq(inboxItems.id, item.id));
    expect(after.status).toBe("used");
    expect(await db.select().from(drafts)).toHaveLength(14);
  });
});
