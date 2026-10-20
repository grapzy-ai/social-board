import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { drafts, type Draft } from "@/lib/db/schema";
import { applyCallback, approvalCardText, approvalKeyboard, parseCallback, sendApprovalCard } from "@/lib/drafts/approval";

const uuid = "11111111-2222-4333-8444-555555555555";
const mkDraft = (over: Partial<Draft> = {}): Draft =>
  ({
    id: uuid,
    inboxItemId: null,
    pillarId: null,
    accountId: null,
    type: "tg",
    language: "ru",
    title: "Мы посчитали <523>",
    body: { text: "Первая строка\n\nВторая & третья" },
    status: "ready",
    assets: null,
    scheduledAt: null,
    approvedAt: null,
    publishedAt: null,
    publishedUrl: null,
    publishedPostId: null,
    publishError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Draft;

describe("approval card", () => {
  beforeEach(() => {
    process.env.APP_BASE_URL = "https://sb.test";
    process.env.TG_REPORT_CHAT_IDS = "5,6";
  });

  it("builds an HTML card with escaped title, preview and the dashboard link", () => {
    const text = approvalCardText(mkDraft());
    expect(text).toContain("<b>Мы посчитали &lt;523&gt;</b>");
    expect(text).toContain("Вторая &amp; третья");
    expect(text).toContain(`https://sb.test/drafts/${uuid}`);
    expect(text).toContain("Telegram");
  });

  it("keyboard has approve/reject for ready and publish-now for approved tg only", () => {
    const ready = approvalKeyboard(mkDraft());
    expect(ready.inline_keyboard[0].map((b) => b.callback_data)).toEqual([`approve:${uuid}`, `reject:${uuid}`]);
    const approvedTg = approvalKeyboard(mkDraft({ status: "approved" }));
    expect(approvedTg.inline_keyboard[0].map((b) => b.callback_data)).toEqual([`publish:${uuid}`]);
    const approvedReel = approvalKeyboard(mkDraft({ status: "approved", type: "reel" }));
    expect(approvedReel.inline_keyboard).toEqual([]);
  });

  it("sendApprovalCard posts to every report chat with HTML and the keyboard", async () => {
    const send = vi.fn(async () => ({ ok: true, messageId: 7 }));
    const res = await sendApprovalCard(mkDraft(), send);
    expect(res).toEqual({ delivered: 2, failed: 0 });
    const [, , opts] = send.mock.calls[0] as unknown as [string, string, { parseMode: string; replyMarkup: unknown }];
    expect(opts.parseMode).toBe("HTML");
    expect(opts.replyMarkup).toEqual(approvalKeyboard(mkDraft()));
  });

  it("parseCallback accepts op:<uuid> and rejects garbage", () => {
    expect(parseCallback(`approve:${uuid}`)).toEqual({ op: "approve", draftId: uuid });
    expect(parseCallback(`publish:${uuid}`)).toEqual({ op: "publish", draftId: uuid });
    expect(parseCallback("approve:not-a-uuid")).toBeNull();
    expect(parseCallback("delete:" + uuid)).toBeNull();
    expect(parseCallback("")).toBeNull();
  });
});

describe("applyCallback", () => {
  let db: TestDb;
  const cb = (data: string) => ({ tgChatId: "5", callbackId: "c1", data, messageId: 9 });
  beforeEach(async () => {
    process.env.APP_BASE_URL = "https://sb.test";
    ({ db } = await makeTestDb());
  });

  it("approve moves ready→approved once; second approve is a noop", async () => {
    const [d] = await db.insert(drafts).values({ type: "threads", title: "t", body: { text: "x" }, status: "ready" }).returning();
    const edit = vi.fn(async () => true);
    const first = await applyCallback(db, cb(`approve:${d.id}`), { edit });
    expect(first.result).toBe("approved");
    const [row] = await db.select().from(drafts).where(eq(drafts.id, d.id));
    expect(row.status).toBe("approved");
    expect(row.approvedAt).not.toBeNull();
    expect(edit).toHaveBeenCalledTimes(1);
    const second = await applyCallback(db, cb(`approve:${d.id}`), { edit });
    expect(second.result).toBe("noop");
  });

  it("reject moves ready→rejected", async () => {
    const [d] = await db.insert(drafts).values({ type: "threads", title: "t", body: { text: "x" }, status: "ready" }).returning();
    expect((await applyCallback(db, cb(`reject:${d.id}`), { edit: async () => true })).result).toBe("rejected");
    const [row] = await db.select().from(drafts).where(eq(drafts.id, d.id));
    expect(row.status).toBe("rejected");
  });

  it("publish calls the injected publisher only when status is approved", async () => {
    const [ok] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "x" }, status: "approved" }).returning();
    const [notYet] = await db.insert(drafts).values({ type: "tg", title: "t2", body: { text: "x" }, status: "draft" }).returning();
    const publish = vi.fn(async () => ({ ok: true as const, url: "https://t.me/vadimbordian/42" }));
    const edit = vi.fn(async () => true);
    const r1 = await applyCallback(db, cb(`publish:${ok.id}`), { publish, edit });
    expect(r1.result).toBe("published");
    expect(publish).toHaveBeenCalledWith(db, ok.id);
    const r2 = await applyCallback(db, cb(`publish:${notYet.id}`), { publish, edit });
    expect(r2.result).toBe("noop");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("reports an error result when the publisher fails", async () => {
    const [d] = await db.insert(drafts).values({ type: "tg", title: "t", body: { text: "x" }, status: "approved" }).returning();
    const r = await applyCallback(db, cb(`publish:${d.id}`), { publish: async () => ({ ok: false, error: "chat not found" }), edit: async () => true });
    expect(r.result).toBe("error");
    expect(r.message).toContain("chat not found");
  });
});
