import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeTestDb, type TestDb } from "../helpers/testdb";
import { inboxItems } from "@/lib/db/schema";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const sendMock = vi.fn(async () => ({ ok: true, messageId: 1 }));
vi.mock("@/lib/telegram/notify", async (orig) => {
  const mod = await orig<typeof import("@/lib/telegram/notify")>();
  return { ...mod, sendMessage: (...a: unknown[]) => sendMock(...(a as [])) };
});

import { POST } from "@/app/api/telegram/webhook/route";
import { webhookSecret } from "@/lib/telegram/webhook";

const post = (body: unknown, secret?: string) =>
  POST(
    new Request("http://x/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) },
      body: JSON.stringify(body),
    }),
  );
const textUpdate = (chatId: number, id = 1, text = "идея: серия про команду") => ({ update_id: id, message: { message_id: id, chat: { id: chatId }, text } });

describe("POST /api/telegram/webhook", () => {
  beforeEach(async () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.TG_REPORT_CHAT_IDS = "5";
    process.env.APP_BASE_URL = "https://sb.test";
    ({ db } = await makeTestDb());
    sendMock.mockClear();
  });

  it("returns 200 and writes nothing on a wrong secret", async () => {
    const res = await post(textUpdate(5), "nope");
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(false);
    expect(await db.select().from(inboxItems)).toHaveLength(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("ignores chats outside the allowlist", async () => {
    const res = await post(textUpdate(777), webhookSecret());
    expect(await res.json()).toMatchObject({ ok: true, action: "ignored" });
    expect(await db.select().from(inboxItems)).toHaveLength(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("inserts a text item and acks with the inbox link", async () => {
    const res = await post(textUpdate(5), webhookSecret());
    expect(await res.json()).toMatchObject({ ok: true, action: "inserted" });
    const rows = await db.select().from(inboxItems);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "text", source: "bot", tgChatId: "5", tgMessageId: 1, text: "идея: серия про команду" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [chatId, text] = sendMock.mock.calls[0] as unknown as [string, string];
    expect(chatId).toBe("5");
    expect(text).toContain(`https://sb.test/inbox/${rows[0].id}`);
  });

  it("is idempotent on Telegram retries", async () => {
    await post(textUpdate(5, 3), webhookSecret());
    const res = await post(textUpdate(5, 3), webhookSecret());
    expect(await res.json()).toMatchObject({ ok: true, action: "duplicate" });
    expect(await db.select().from(inboxItems)).toHaveLength(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
