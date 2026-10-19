import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeThreadsCode } from "@/lib/oauth/threads";
import { addAccount } from "@/lib/sync/tokens";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const raw = jar.get("threads_oauth_state")?.value;
  jar.delete("threads_oauth_state");
  const saved = raw ? (JSON.parse(raw) as { state: string; language: "ru" | "en"; role: "focus" | "mirror" | "lifestyle" }) : null;
  if (!code || !state || !saved || saved.state !== state) {
    return NextResponse.redirect(new URL("/settings/accounts?error=oauth_state", process.env.APP_BASE_URL));
  }
  const t = await exchangeThreadsCode(code);
  await addAccount(getDb(), {
    platform: "threads",
    handle: t.username,
    externalUserId: t.userId,
    language: saved.language,
    role: saved.role,
    token: t.longLivedToken,
    expiresAt: t.expiresAt,
  });
  return NextResponse.redirect(new URL("/settings/accounts?connected=threads", process.env.APP_BASE_URL));
}
