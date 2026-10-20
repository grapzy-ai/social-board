import { cookies } from "next/headers";
import { currentUserEmail } from "@/lib/supabase/server";
import { resolveSegment, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { resolveTheme, THEME_COOKIE } from "@/lib/ui/theme";
import type { PeriodSpec } from "@/lib/ui/period";
import { SegmentSwitch } from "@/components/ui/SegmentSwitch";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PeriodPicker } from "@/components/ui/PeriodPicker";

/** Top bar every page renders: title · segment · period · page actions · theme · user. Reads cookies itself. */
export async function PageHeader({
  title,
  subtitle,
  spec,
  basePath,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  spec?: PeriodSpec;
  basePath?: string;
  actions?: React.ReactNode;
}) {
  const jar = await cookies();
  const segment = resolveSegment(jar.get(SEGMENT_COOKIE)?.value);
  const theme = resolveTheme(jar.get(THEME_COOKIE)?.value);
  const email = await currentUserEmail();
  return (
    <header className="mb-6 flex flex-wrap items-center gap-3">
      <div className="mr-auto">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <SegmentSwitch current={segment} />
      {spec && basePath && <PeriodPicker spec={spec} basePath={basePath} />}
      {actions}
      <ThemeToggle current={theme} />
      <form action="/api/auth/signout" method="post" className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden md:inline">{email}</span>
        <button className="rounded border border-line px-2 py-1 hover:text-fg">выйти</button>
      </form>
    </header>
  );
}
