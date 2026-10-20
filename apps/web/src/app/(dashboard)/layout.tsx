import Link from "next/link";
import { currentUserEmail } from "@/lib/supabase/server";

const NAV = [
  { href: "/", label: "Обзор" },
  { href: "/posts", label: "Посты" },
  { href: "/settings/accounts", label: "Настройки" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const email = await currentUserEmail();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-900 bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="vb-badge">VB</span>
            <span className="text-sm font-semibold tracking-tight">Social Board</span>
          </Link>
          <nav className="flex gap-4 text-sm text-neutral-400">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action="/api/auth/signout" method="post" className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
            <span>{email}</span>
            <button className="rounded border border-neutral-800 px-2 py-1 hover:text-white">выйти</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
