import { describe, it, expect, vi, afterEach } from "vitest";
import { sendBotMessage } from "@/lib/telegram/notify";

describe("sendBotMessage", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("posts to the Bot API sendMessage endpoint with chat_id and text", async () => {
    process.env.TG_BOT_TOKEN = "123:abc";
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect(await sendBotMessage("42", "привет")).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(String(init.body))).toMatchObject({ chat_id: "42", text: "привет" });
  });
  it("returns false without throwing when the token is missing or the call fails", async () => {
    delete process.env.TG_BOT_TOKEN;
    expect(await sendBotMessage("42", "x")).toBe(false);
    process.env.TG_BOT_TOKEN = "t";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    expect(await sendBotMessage("42", "x")).toBe(false);
  });
});

describe("notifyAll", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("reports how many chats were delivered to", async () => {
    const { notifyAll } = await import("@/lib/telegram/notify");
    process.env.TG_BOT_TOKEN = "t";
    process.env.TG_REPORT_CHAT_IDS = "1,2";
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: ++n === 1 ? 200 : 500 })));
    expect(await notifyAll("x")).toEqual({ delivered: 1, failed: 1 });
  });
});
