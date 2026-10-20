import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { accounts, drafts } from "@/lib/db/schema";
import { makeTelegramPublisher, renderTelegramHtml, TG_MAX_TEXT } from "@/lib/publish/telegram";

const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });

describe("renderTelegramHtml", () => {
  it("renders the first line bold and escapes html", () => {
    expect(renderTelegramHtml({ text: "Заголовок <x>\nтекст & ещё" })).toBe("<b>Заголовок &lt;x&gt;</b>\nтекст &amp; ещё");
  });
  it("keeps paragraphs and bullets", () => {
    expect(renderTelegramHtml({ text: "Первая\n\n• раз\n• два" })).toBe("<b>Первая</b>\n\n• раз\n• два");
  });
});

describe("makeTelegramPublisher", () => {
  let db: TestDb;
  let tgId: string;
  beforeEach(async () => {
    process.env.TG_BOT_TOKEN = "123:abc";
    ({ db } = await makeTestDb());
    const [a] = await db.insert(accounts).values({ platform: "telegram", handle: "vadimbordian", language: "ru" }).returning();
    tgId = a.id;
  });

  it("publishes an approved tg draft to @handle and stores url/status once", async () => {
    const [d] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "Заголовок\n\nтекст" }, status: "approved", accountId: tgId }).returning();
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.chat_id).toBe("@vadimbordian");
      expect(body.parse_mode).toBe("HTML");
      expect(body.text).toBe("<b>Заголовок</b>\n\nтекст");
      return json({ ok: true, result: { message_id: 42 } });
    });
    const publish = makeTelegramPublisher(f as unknown as typeof fetch);
    const r = await publish(db, d.id);
    expect(r).toEqual({ ok: true, url: "https://t.me/vadimbordian/42" });
    const [row] = await db.select().from(drafts).where(eq(drafts.id, d.id));
    expect(row.status).toBe("published");
    expect(row.publishedUrl).toBe("https://t.me/vadimbordian/42");
    expect(row.publishedAt).not.toBeNull();
    const again = await publish(db, d.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toMatch(/опубликован/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("keeps status approved and records publish_error on Telegram failure", async () => {
    const [d] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "x\ny" }, status: "approved", accountId: tgId }).returning();
    const publish = makeTelegramPublisher(vi.fn(async () => json({ ok: false, description: "Bad Request: chat not found" })) as unknown as typeof fetch);
    const r = await publish(db, d.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("chat not found");
    const [row] = await db.select().from(drafts).where(eq(drafts.id, d.id));
    expect(row.status).toBe("approved");
    expect(row.publishError).toContain("chat not found");
  });

  it("refuses non-approved, non-tg or account-less drafts without calling Telegram", async () => {
    const f = vi.fn();
    const publish = makeTelegramPublisher(f as unknown as typeof fetch);
    const [draftOnly] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "x" }, status: "draft", accountId: tgId }).returning();
    const [reel] = await db.insert(drafts).values({ type: "reel", title: "t", body: { script: "s", hooks: [], cover: "c" }, status: "approved", accountId: tgId }).returning();
    const [noAcc] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "x" }, status: "approved" }).returning();
    for (const d of [draftOnly, reel, noAcc]) expect((await publish(db, d.id)).ok).toBe(false);
    expect((await publish(db, "00000000-0000-0000-0000-000000000000")).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("refuses texts over 4096 chars", async () => {
    const f = vi.fn();
    const [d] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "а".repeat(TG_MAX_TEXT + 1) }, status: "approved", accountId: tgId }).returning();
    const r = await makeTelegramPublisher(f as unknown as typeof fetch)(db, d.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("4096");
    expect(f).not.toHaveBeenCalled();
  });

  it("two overlapping publishes post exactly once (claim before send)", async () => {
    const [d] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "Заголовок\n\nтекст" }, status: "approved", accountId: tgId }).returning();
    let n = 0;
    const f = vi.fn(async () => {
      n += 1;
      await new Promise((r) => setTimeout(r, 50));
      return json({ ok: true, result: { message_id: n } });
    });
    const publish = makeTelegramPublisher(f as unknown as typeof fetch);
    const [a, b] = await Promise.all([publish(db, d.id), publish(db, d.id)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(1);
    const [row] = await db.select().from(drafts).where(eq(drafts.id, d.id));
    expect(row.status).toBe("published");
    expect(row.publishedUrl).toBe("https://t.me/vadimbordian/1");
  });

  it("records publish_error for an approved draft that cannot be sent (no account)", async () => {
    const [d] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "x" }, status: "approved" }).returning();
    const r = await makeTelegramPublisher(vi.fn() as unknown as typeof fetch)(db, d.id);
    expect(r.ok).toBe(false);
    const [row] = await db.select().from(drafts).where(eq(drafts.id, d.id));
    expect(row.status).toBe("approved");
    expect(row.publishError).toMatch(/аккаунт/);
  });
});
