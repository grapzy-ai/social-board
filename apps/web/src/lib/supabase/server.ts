import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServer() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          /* called from a Server Component — middleware refreshes the session */
        }
      },
    },
  });
}

export async function currentUserEmail(): Promise<string | null> {
  const sb = await createSupabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}
