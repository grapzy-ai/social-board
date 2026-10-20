"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAllowedUser } from "@/lib/auth/require";
import { resolveTheme, THEME_COOKIE } from "@/lib/ui/theme";

const YEAR = 60 * 60 * 24 * 365;

export async function setThemeAction(formData: FormData) {
  await requireAllowedUser();
  const jar = await cookies();
  jar.set(THEME_COOKIE, resolveTheme(String(formData.get("theme") ?? "")), { maxAge: YEAR, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
