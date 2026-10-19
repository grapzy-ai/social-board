"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/auth/allowlist";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isAllowed(email)) redirect("/login?denied=1");
  const sb = await createSupabaseServer();
  const base = process.env.APP_BASE_URL!;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${base}/api/auth/callback?next=/` } });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?sent=1");
}
