/** Bot administration calls used from Settings: webhook wiring and channel-rights check. All injectable for tests. */

function token(): string {
  return process.env.TG_BOT_TOKEN ?? "";
}

async function call<T>(method: string, body: Record<string, unknown>, f: typeof fetch): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const res = await f(`https://api.telegram.org/bot${token()}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    return { ok: res.ok && json.ok !== false, result: json.result, description: json.description };
  } catch (e) {
    return { ok: false, description: (e as Error).message };
  }
}

export async function setWebhook(url: string, secretToken: string, f: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  const r = await call("setWebhook", { url, secret_token: secretToken, allowed_updates: ["message", "callback_query"], drop_pending_updates: false }, f);
  return r.ok ? { ok: true } : { ok: false, error: r.description };
}

export async function getWebhookInfo(f: typeof fetch = fetch): Promise<{ url: string; pendingUpdateCount: number; lastErrorMessage: string | null } | null> {
  const r = await call<{ url?: string; pending_update_count?: number; last_error_message?: string }>("getWebhookInfo", {}, f);
  if (!r.ok || !r.result) return null;
  return { url: r.result.url ?? "", pendingUpdateCount: r.result.pending_update_count ?? 0, lastErrorMessage: r.result.last_error_message ?? null };
}

/** The bot's user id is the numeric part before the colon in its token. */
export function botId(): number | null {
  const m = token().match(/^(\d+):/);
  return m ? Number(m[1]) : null;
}

export async function getChatMember(chat: string, userId: number, f: typeof fetch = fetch): Promise<{ status: string; canPost: boolean } | null> {
  const r = await call<{ status?: string; can_post_messages?: boolean }>("getChatMember", { chat_id: chat, user_id: userId }, f);
  if (!r.ok || !r.result) return null;
  const status = r.result.status ?? "unknown";
  return { status, canPost: status === "creator" || (status === "administrator" && r.result.can_post_messages === true) };
}
