import { and, eq } from "drizzle-orm";
import type { AnyDb } from "@/lib/db/types";
import { drafts, type Draft } from "@/lib/db/schema";
import type { CallbackInput } from "@/lib/telegram/updates";
import { editMessageText, reportChatIds, sendMessage, type NotifyResult, type SendOptions, type SendResult } from "@/lib/telegram/notify";
import { DRAFT_TYPE_LABEL } from "@/lib/ui/factory-labels";
import { bodyText } from "./status";

/** Publishes an approved draft; implemented per platform (Task 9: Telegram). */
export type Publisher = (db: AnyDb, draftId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base = () => (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function approvalCardText(d: Draft, note?: string): string {
  const preview = bodyText(d.body);
  const cut = preview.length > 700 ? preview.slice(0, 700).trimEnd() + "…" : preview;
  return [`📝 На согласование · ${DRAFT_TYPE_LABEL[d.type]}`, `<b>${escapeHtml(d.title)}</b>`, ``, escapeHtml(cut), ``, `${base()}/drafts/${d.id}`, note ? `\n${note}` : ""].join("\n").trimEnd();
}

export type Keyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

export function approvalKeyboard(d: Draft): Keyboard {
  if (d.status === "ready") {
    return { inline_keyboard: [[{ text: "✅ Согласовать", callback_data: `approve:${d.id}` }, { text: "✖ Отклонить", callback_data: `reject:${d.id}` }]] };
  }
  if (d.status === "approved" && d.type === "tg") {
    return { inline_keyboard: [[{ text: "🚀 Опубликовать сейчас", callback_data: `publish:${d.id}` }]] };
  }
  return { inline_keyboard: [] };
}

type Sender = (chatId: string, text: string, opts?: SendOptions) => Promise<SendResult>;

export async function sendApprovalCard(d: Draft, send: Sender = sendMessage): Promise<NotifyResult> {
  const text = approvalCardText(d);
  const results = await Promise.all(reportChatIds().map((id) => send(id, text, { parseMode: "HTML", replyMarkup: approvalKeyboard(d) })));
  const delivered = results.filter((r) => r.ok).length;
  return { delivered, failed: results.length - delivered };
}

export function parseCallback(data: string): { op: "approve" | "reject" | "publish"; draftId: string } | null {
  const m = data.match(/^(approve|reject|publish):(.+)$/);
  if (!m || !UUID_RE.test(m[2])) return null;
  return { op: m[1] as "approve" | "reject" | "publish", draftId: m[2] };
}

export interface CallbackDeps {
  publish?: Publisher;
  edit?: (chatId: string, messageId: number, text: string, opts?: SendOptions) => Promise<boolean>;
}

export type CallbackResult = { result: "approved" | "rejected" | "published" | "noop" | "error"; message: string };

/** Applies an inline-button press. Each transition is a guarded UPDATE so a double tap is a noop, not a double action. */
export async function applyCallback(db: AnyDb, cb: CallbackInput, deps: CallbackDeps = {}): Promise<CallbackResult> {
  const parsed = parseCallback(cb.data);
  if (!parsed) return { result: "noop", message: "непонятная кнопка" };
  const edit = deps.edit ?? editMessageText;
  const [d] = await db.select().from(drafts).where(eq(drafts.id, parsed.draftId)).limit(1);
  if (!d) return { result: "noop", message: "черновик не найден" };
  const now = new Date();

  if (parsed.op === "approve" || parsed.op === "reject") {
    const to = parsed.op === "approve" ? "approved" : "rejected";
    const updated = await db
      .update(drafts)
      .set({ status: to, updatedAt: now, ...(to === "approved" ? { approvedAt: now } : {}) })
      .where(and(eq(drafts.id, d.id), eq(drafts.status, "ready")))
      .returning({ id: drafts.id });
    if (updated.length === 0) return { result: "noop", message: "уже обработано" };
    const fresh = { ...d, status: to } as Draft;
    await edit(cb.tgChatId, cb.messageId, approvalCardText(fresh, to === "approved" ? "✅ Согласовано" : "✖ Отклонено"), { parseMode: "HTML", replyMarkup: approvalKeyboard(fresh) });
    return { result: to, message: to === "approved" ? "Согласовано" : "Отклонено" };
  }

  // publish
  if (d.status !== "approved") return { result: "noop", message: d.status === "published" ? "уже опубликовано" : "сначала согласуй" };
  if (!deps.publish) return { result: "error", message: "публикация для этого типа ещё не подключена" };
  const r = await deps.publish(db, d.id);
  if (r.ok) {
    await edit(cb.tgChatId, cb.messageId, approvalCardText({ ...d, status: "published" } as Draft, `🚀 Опубликовано: ${r.url}`), { parseMode: "HTML", replyMarkup: { inline_keyboard: [] } });
    return { result: "published", message: "Опубликовано" };
  }
  await edit(cb.tgChatId, cb.messageId, approvalCardText(d, `⚠️ Не опубликовано: ${escapeHtml(r.error)}`), { parseMode: "HTML", replyMarkup: approvalKeyboard(d) });
  return { result: "error", message: `Не опубликовано: ${r.error}` };
}
