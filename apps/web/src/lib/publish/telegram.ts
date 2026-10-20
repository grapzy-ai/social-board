import { and, eq } from "drizzle-orm";
import type { AnyDb } from "@/lib/db/types";
import { accounts, drafts } from "@/lib/db/schema";
import type { Publisher } from "@/lib/drafts/approval";
import { escapeHtml } from "@/lib/drafts/approval";

export const TG_MAX_TEXT = 4096;

/** Vadim's Telegram posts open with a bold headline; the rest is plain text with his own line breaks and bullets. */
export function renderTelegramHtml(body: { text: string }): string {
  const [first, ...rest] = body.text.replace(/\r\n/g, "\n").split("\n");
  const head = first.trim() ? `<b>${escapeHtml(first.trim())}</b>` : "";
  return [head, ...rest.map(escapeHtml)].join("\n");
}

/**
 * Publishes an approved `tg` draft to the channel of its account (`@handle`) through the bot.
 * The row is CLAIMED first (`approved` → `publishing`, guarded UPDATE), then Telegram is called once,
 * then the row becomes `published` — so two overlapping calls post exactly once (Review Focus 5).
 * Every failure of an approved draft is written to `publish_error` so the dashboard can show it.
 */
export function makeTelegramPublisher(f: typeof fetch = fetch): Publisher {
  return async (db: AnyDb, draftId: string) => {
    const [d] = await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1);
    if (!d) return { ok: false, error: "черновик не найден" };
    if (d.status === "published") return { ok: false, error: "уже опубликован" };
    if (d.status === "publishing") return { ok: false, error: "уже публикуется" };
    if (d.status !== "approved") return { ok: false, error: "не согласован" };

    const fail = async (error: string) => {
      await db.update(drafts).set({ publishError: error, updatedAt: new Date() }).where(eq(drafts.id, d.id));
      return { ok: false as const, error };
    };
    if (d.type !== "tg") return fail("публикация пока только для Telegram");
    if (!d.accountId) return fail("у черновика нет Telegram-аккаунта");
    if (!("text" in d.body)) return fail("пустой текст");
    const html = renderTelegramHtml(d.body);
    if (html.length > TG_MAX_TEXT) return fail(`текст длиннее ${TG_MAX_TEXT} символов — Telegram не примет`);
    const [acc] = await db.select({ handle: accounts.handle }).from(accounts).where(eq(accounts.id, d.accountId)).limit(1);
    if (!acc) return fail("аккаунт не найден");
    const token = process.env.TG_BOT_TOKEN;
    if (!token) return fail("TG_BOT_TOKEN не задан");

    // claim
    const claimed = await db
      .update(drafts)
      .set({ status: "publishing", updatedAt: new Date() })
      .where(and(eq(drafts.id, d.id), eq(drafts.status, "approved")))
      .returning({ id: drafts.id });
    if (claimed.length === 0) return { ok: false, error: "уже публикуется или опубликован" };

    let messageId: number | null = null;
    let error: string | null = null;
    try {
      const res = await f(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: `@${acc.handle}`, text: html, parse_mode: "HTML", disable_web_page_preview: false }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number }; description?: string };
      if (res.ok && json.ok && typeof json.result?.message_id === "number") messageId = json.result.message_id;
      else error = json.description ?? `HTTP ${res.status}`;
    } catch (e) {
      error = (e as Error).message;
    }

    const now = new Date();
    if (messageId === null) {
      // release the claim; the draft stays approved with the error visible
      await db.update(drafts).set({ status: "approved", publishError: error ?? "unknown", updatedAt: now }).where(and(eq(drafts.id, d.id), eq(drafts.status, "publishing")));
      return { ok: false, error: error ?? "unknown" };
    }
    const url = `https://t.me/${acc.handle}/${messageId}`;
    await db
      .update(drafts)
      .set({ status: "published", publishedAt: now, publishedUrl: url, publishError: null, updatedAt: now })
      .where(and(eq(drafts.id, d.id), eq(drafts.status, "publishing")));
    return { ok: true, url };
  };
}
