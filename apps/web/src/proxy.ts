import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowed } from "@/lib/auth/allowlist";

const PUBLIC_PREFIXES = ["/login", "/api/cron", "/api/health", "/api/auth/callback"];

/** Local visual harness only (scripts/dev-db.mjs): needs an explicit flag and never applies on Vercel. */
const DEV_BYPASS = process.env.DEV_BYPASS_AUTH === "1" && !process.env.VERCEL && !process.env.VERCEL_ENV;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (DEV_BYPASS) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!isAllowed(email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?denied=1";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)).*)"],
};
