export interface SendOptions {
  replyMarkup?: unknown;
  parseMode?: "HTML";
  disablePreview?: boolean;
}

export interface SendResult {
  ok: boolean;
  messageId: number | null;
  error?: string;
}

async function botCall(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) return { ok: false, description: "TG_BOT_TOKEN missing" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let json: { ok?: boolean; result?: unknown; description?: string } = {};
    try {
      json = (await res.json()) as typeof json;
    } catch {
      /* non-JSON body */
    }
    return { ok: res.ok && json.ok !== false, result: json.result, description: json.description };
  } catch (e) {
    return { ok: false, description: (e as Error).message };
  }
}

/** Sends a Telegram Bot API message to any chat (user, group or @channel). Never throws. */
export async function sendMessage(chatId: string, text: string, opts: SendOptions = {}): Promise<SendResult> {
  const r = await botCall("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: opts.disablePreview ?? true,
    ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
  const messageId = r.ok && r.result && typeof (r.result as { message_id?: number }).message_id === "number" ? (r.result as { message_id: number }).message_id : null;
  return { ok: r.ok, messageId, error: r.ok ? undefined : r.description };
}

/** Boolean convenience kept for the stage-1 callers (cron digests, signals). */
export async function sendBotMessage(chatId: string, text: string): Promise<boolean> {
  return (await sendMessage(chatId, text)).ok;
}

export async function editMessageText(chatId: string, messageId: number, text: string, opts: SendOptions = {}): Promise<boolean> {
  const r = await botCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: opts.disablePreview ?? true,
    ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
  return r.ok;
}

export async function answerCallback(callbackId: string, text?: string): Promise<boolean> {
  const r = await botCall("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
  return r.ok;
}

export function reportChatIds(): string[] {
  return (process.env.TG_REPORT_CHAT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export interface NotifyResult {
  delivered: number;
  failed: number;
}

/** Sends to every report chat; counts successes so callers can decide whether the message really went out. */
export async function notifyAll(text: string, opts: SendOptions = {}): Promise<NotifyResult> {
  const results = await Promise.all(reportChatIds().map((id) => sendMessage(id, text, opts)));
  const delivered = results.filter((r) => r.ok).length;
  return { delivered, failed: results.length - delivered };
}
