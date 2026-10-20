import { createHash, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { inboxItems, type InboxKind, type SortTags } from "@/lib/db/schema";
import { parseUpdate, type CallbackInput, type InboxInput } from "./updates";
import { reportChatIds, sendMessage, type SendResult, type SendOptions } from "./notify";
import { describeTags, KIND_LABEL } from "@/lib/ui/factory-labels";

export type Sorter = (input: { text: string; kind: InboxKind }) => Promise<SortTags>;
export type Transcriber = (buf: Buffer, filename: string) => Promise<string | null>;
export type Downloader = (fileId: string) => Promise<{ buf: Buffer; path: string } | null>;
export type CallbackHandler = (db: Db, cb: CallbackInput) => Promise<void>;

export interface WebhookDeps {
  sort?: Sorter;
  transcribe?: Transcriber;
  download?: Downloader;
  send?: (chatId: string, text: string, opts?: SendOptions) => Promise<SendResult>;
  onCallback?: CallbackHandler;
  now?: Date;
}

/** Derived once from CRON_SECRET so the deployment needs no extra env var. */
export function webhookSecret(cronSecret = process.env.CRON_SECRET ?? ""): string {
  return createHash("sha256").update(`tg-webhook:${cronSecret}`).digest("hex");
}

export function secretMatches(given: string | null): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(webhookSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAllowedChat(chatId: string, allow: string[] = reportChatIds()): boolean {
  return allow.includes(chatId);
}

export type UpdateOutcome = { action: "ignored" | "inserted" | "duplicate" | "callback"; itemId?: string };

/** Any DB type that has the drizzle query surface we use (prod postgres-js or test pglite). */
type AnyDb = Pick<Db, "insert" | "select" | "update">;

async function findExisting(db: AnyDb, m: InboxInput) {
  const rows = await db
    .select({ id: inboxItems.id })
    .from(inboxItems)
    .where(and(eq(inboxItems.tgChatId, m.tgChatId), eq(inboxItems.tgMessageId, m.tgMessageId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function handleUpdate(db: AnyDb, update: unknown, deps: WebhookDeps = {}): Promise<UpdateOutcome> {
  const parsed = parseUpdate(update);
  if (!parsed) return { action: "ignored" };
  const send = deps.send ?? sendMessage;

  if ("callback" in parsed) {
    if (!isAllowedChat(parsed.callback.tgChatId)) return { action: "ignored" };
    if (deps.onCallback) await deps.onCallback(db as Db, parsed.callback);
    return { action: "callback" };
  }

  const m = parsed.message;
  if (!isAllowedChat(m.tgChatId)) return { action: "ignored" };
  if (await findExisting(db, m)) return { action: "duplicate" };

  let transcript: string | null = null;
  let transcriptNote = "";
  if (m.kind === "voice" && m.tgFileId && deps.download) {
    const file = await deps.download(m.tgFileId);
    if (file && deps.transcribe) transcript = await deps.transcribe(file.buf, file.path.split("/").pop() ?? "voice.oga");
    transcriptNote = transcript ? `\n📝 ${transcript.slice(0, 200)}${transcript.length > 200 ? "…" : ""}` : "\n⏳ ждёт расшифровки (нет ключа распознавания)";
  }

  let inserted: { id: string };
  try {
    [inserted] = await db
      .insert(inboxItems)
      .values({ source: "bot", kind: m.kind, tgChatId: m.tgChatId, tgMessageId: m.tgMessageId, tgFileId: m.tgFileId, text: m.text, transcript, mediaRef: m.mediaRef })
      .returning({ id: inboxItems.id });
  } catch (e) {
    // Unique violation = concurrent retry of the same message.
    if (await findExisting(db, m)) return { action: "duplicate" };
    throw e;
  }

  let sortNote = "";
  const sortable = (transcript ?? m.text ?? "").trim();
  if (deps.sort && sortable) {
    const tags = await deps.sort({ text: sortable, kind: m.kind });
    await db
      .update(inboxItems)
      .set({ tags, language: tags.language, status: "sorted", updatedAt: deps.now ?? new Date() })
      .where(eq(inboxItems.id, inserted.id));
    sortNote = `\n→ ${describeTags(tags)}`;
  }

  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  await send(m.tgChatId, `✅ Принял (${KIND_LABEL[m.kind]}).${transcriptNote}${sortNote}\nОткрыть: ${base}/inbox/${inserted.id}`);
  return { action: "inserted", itemId: inserted.id };
}
