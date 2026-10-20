import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const sb = await createSupabaseServer();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL ?? new URL(req.url).origin), { status: 303 });
}
