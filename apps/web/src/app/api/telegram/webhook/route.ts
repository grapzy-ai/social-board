import { getDb } from "@/lib/db/client";
import { handleUpdate, secretMatches } from "@/lib/telegram/webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Telegram Bot API webhook. Always answers 200: a non-2xx makes Telegram retry the same update
 * for hours, and a wrong secret is not something we want retried.
 */
export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"))) return Response.json({ ok: false });
  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: false });
  }
  try {
    const out = await handleUpdate(getDb(), update);
    return Response.json({ ok: true, ...out });
  } catch (e) {
    console.error("telegram webhook", e);
    return Response.json({ ok: true, action: "error" });
  }
}
