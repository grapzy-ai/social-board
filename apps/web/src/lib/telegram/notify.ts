/** Sends a Telegram Bot API message. Never throws; returns delivery success. */
export async function sendBotMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function reportChatIds(): string[] {
  return (process.env.TG_REPORT_CHAT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function notifyAll(text: string): Promise<void> {
  await Promise.all(reportChatIds().map((id) => sendBotMessage(id, text)));
}
