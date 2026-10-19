import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { threadsAuthorizeUrl } from "@/lib/oauth/threads";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const language = url.searchParams.get("language") === "en" ? "en" : "ru";
  const role = url.searchParams.get("role") ?? "focus";
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("threads_oauth_state", JSON.stringify({ state, language, role }), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(threadsAuthorizeUrl(state));
}
