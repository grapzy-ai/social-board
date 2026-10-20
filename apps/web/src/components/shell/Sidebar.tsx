"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_SECTIONS } from "@/lib/ui/nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-line bg-surface px-4 py-5">
      <Link href="/" className="mb-6 flex items-center gap-2 px-1">
        <span className="vb-badge">VB</span>
        <span className="text-sm font-semibold tracking-tight">Social Board</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-5 text-sm">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-muted">{section.title}</div>
            <ul className="space-y-0.5">
              {section.items.map((item) =>
                item.ready ? (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      className={`block rounded-md px-2 py-1.5 ${isActive(pathname, item.href) ? "bg-card font-medium text-fg shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:bg-card hover:text-fg"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={item.href} className="flex items-center justify-between px-2 py-1.5 text-muted/60">
                    <span>{item.label}</span>
                    <span className="rounded border border-line px-1 text-[10px] leading-4">скоро</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-2 text-[11px] text-muted">2026 · 0—02</div>
    </aside>
  );
}
