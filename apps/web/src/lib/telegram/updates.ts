import type { InboxKind } from "@/lib/db/schema";

export type InboxInput = {
  kind: InboxKind;
  tgChatId: string;
  tgMessageId: number;
  text: string | null;
  tgFileId: string | null;
  /** First URL in the message (Drive link, reference reel, …). */
  mediaRef: string | null;
};

export type CallbackInput = { tgChatId: string; callbackId: string; data: string; messageId: number };

type Entity = { type: string; offset: number; length: number; url?: string };
type Msg = {
  message_id: number;
  chat: { id: number | string };
  text?: string;
  caption?: string;
  entities?: Entity[];
  caption_entities?: Entity[];
  voice?: { file_id: string };
  audio?: { file_id: string };
  video?: { file_id: string };
  video_note?: { file_id: string };
  photo?: { file_id: string; width?: number }[];
  document?: { file_id: string };
  forward_origin?: unknown;
  forward_from_chat?: unknown;
  forward_from?: unknown;
};

function firstUrl(text: string, entities: Entity[] | undefined): string | null {
  for (const e of entities ?? []) {
    if (e.type === "text_link" && e.url) return e.url;
    if (e.type === "url") return Array.from(text).slice(e.offset, e.offset + e.length).join("");
  }
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

/** Classifies a raw Bot API update. Returns null for update types we do not handle. */
export function parseUpdate(update: unknown): { message: InboxInput } | { callback: CallbackInput } | null {
  if (!update || typeof update !== "object") return null;
  const u = update as { message?: Msg; callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number | string } } } };
  if (u.callback_query?.message && typeof u.callback_query.data === "string") {
    const cq = u.callback_query;
    return { callback: { tgChatId: String(cq.message!.chat.id), callbackId: cq.id, data: cq.data!, messageId: cq.message!.message_id } };
  }
  const m = u.message;
  if (!m || typeof m.message_id !== "number" || !m.chat) return null;
  const text = m.text ?? m.caption ?? null;
  const mediaRef = text ? firstUrl(text, m.entities ?? m.caption_entities) : null;
  const base = { tgChatId: String(m.chat.id), tgMessageId: m.message_id, text, tgFileId: null as string | null, mediaRef };
  if (m.forward_origin || m.forward_from_chat || m.forward_from) return { message: { ...base, kind: "forward" } };
  if (m.voice) return { message: { ...base, kind: "voice", tgFileId: m.voice.file_id } };
  if (m.audio) return { message: { ...base, kind: "voice", tgFileId: m.audio.file_id } };
  if (m.video) return { message: { ...base, kind: "video", tgFileId: m.video.file_id } };
  if (m.video_note) return { message: { ...base, kind: "video", tgFileId: m.video_note.file_id } };
  if (m.photo?.length) {
    const largest = [...m.photo].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
    return { message: { ...base, kind: "photo", tgFileId: largest.file_id } };
  }
  if (m.document) return { message: { ...base, kind: "document", tgFileId: m.document.file_id } };
  if (text === null) return null;
  const onlyLink = mediaRef !== null && text.trim() === mediaRef;
  return { message: { ...base, kind: onlyLink ? "link" : "text" } };
}
