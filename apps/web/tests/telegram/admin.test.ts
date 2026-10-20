import { describe, it, expect, vi, beforeEach } from "vitest";
import { botId, getChatMember, getWebhookInfo, setWebhook } from "@/lib/telegram/admin";

const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });

describe("telegram admin", () => {
  beforeEach(() => {
    process.env.TG_BOT_TOKEN = "123456:abc";
  });

  it("setWebhook posts url, secret_token and allowed_updates", async () => {
    const f = vi.fn(async (u: string, init: RequestInit) => {
      expect(u).toBe("https://api.telegram.org/bot123456:abc/setWebhook");
      expect(JSON.parse(String(init.body))).toEqual({ url: "https://sb.test/api/telegram/webhook", secret_token: "sec", allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
      return json({ ok: true, result: true });
    });
    expect(await setWebhook("https://sb.test/api/telegram/webhook", "sec", f as unknown as typeof fetch)).toEqual({ ok: true });
  });

  it("getWebhookInfo returns url, pending count and last error", async () => {
    const f = vi.fn(async () => json({ ok: true, result: { url: "https://sb.test/api/telegram/webhook", pending_update_count: 2, last_error_message: "x" } }));
    expect(await getWebhookInfo(f as unknown as typeof fetch)).toEqual({ url: "https://sb.test/api/telegram/webhook", pendingUpdateCount: 2, lastErrorMessage: "x" });
  });

  it("botId is the numeric prefix of the token; getChatMember reports canPost", async () => {
    expect(botId()).toBe(123456);
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({ chat_id: "@vadimbordian", user_id: 123456 });
      return json({ ok: true, result: { status: "administrator", can_post_messages: true } });
    });
    expect(await getChatMember("@vadimbordian", 123456, f as unknown as typeof fetch)).toEqual({ status: "administrator", canPost: true });
    const g = vi.fn(async () => json({ ok: true, result: { status: "member" } }));
    expect(await getChatMember("@vadimbordian", 123456, g as unknown as typeof fetch)).toEqual({ status: "member", canPost: false });
  });
});
