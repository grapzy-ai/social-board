import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Magic-link / PKCE code exchange. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await createSupabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  // Always land on the dashboard root: no caller-controlled redirect target.
  return NextResponse.redirect(new URL("/", process.env.APP_BASE_URL ?? url.origin));
}
