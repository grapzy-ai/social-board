import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getOverview } from "@/lib/queries/overview";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { resolvePeriod } from "@/lib/ui/period";
import { PageHeader } from "@/components/shell/PageHeader";
import { chisinauDate } from "@/lib/time";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { accountColor, fmtDelta, fmtInt, PLATFORM_LABEL } from "@/lib/ui/platform";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const segment = resolveSegment((await cookies()).get(SEGMENT_COOKIE)?.value);
  const now = new Date();
  const spec = resolvePeriod(sp, chisinauDate(now));
  const o = await getOverview(getDb(), spec, now, segmentLanguage(segment));
  const period = spec.days;

  const perPlatformIndex = new Map<string, number>();
  const series = o.accounts.map((a) => {
    const i = perPlatformIndex.get(a.platform) ?? 0;
    perPlatformIndex.set(a.platform, i + 1);
    return { key: a.accountId, label: `${PLATFORM_LABEL[a.platform]} ${a.language === "en" ? "EN" : ""}`.trim(), color: accountColor(a.platform, a.language, i) };
  });
  const colorOf = Object.fromEntries(series.map((s) => [s.key, s.color]));
  const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader title="Обзор" spec={spec} basePath="/" />

      <section>
        <h2 className="mb-3 text-sm uppercase tracking-wide text-muted">Цели на {monthName}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {o.accounts.length === 0 && (
            <p className="card p-5 text-sm text-muted">
              Аккаунтов нет. <Link className="text-accent" href="/settings/accounts">Подключить →</Link>
            </p>
          )}
          {o.accounts.map((a) => (
            <article key={a.accountId} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorOf[a.accountId] }} />
                  <span className="text-sm font-medium">{PLATFORM_LABEL[a.platform]}{a.language === "en" ? " EN" : ""}</span>
                  <span className="text-xs text-muted">@{a.handle}</span>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>{fmtDelta(a.deltaYesterday)} вчера</div>
                  <div className={a.deltaToday && a.deltaToday > 0 ? "text-accent" : ""}>{fmtDelta(a.deltaToday)} сегодня</div>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{fmtInt(a.followers)}</span>
                {a.goal && <span className="text-sm text-muted">→ {fmtInt(a.goal.target)}</span>}
              </div>
              {a.goal ? (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded bg-line">
                    <div className="h-full rounded" style={{ width: `${Math.min(100, a.goal.progressPct)}%`, background: colorOf[a.accountId] }} />
                  </div>
                  <div className="mt-1 text-right text-xs text-muted">{a.goal.progressPct}%</div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Цель не задана — <Link className="text-accent" href="/settings/accounts">задать</Link>
                </p>
              )}
              {a.comment && <p className="mt-3 text-sm text-fg">{a.comment}</p>}
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-xs">
                <div><dt className="text-muted">За период</dt><dd className="tabular-nums">{fmtDelta(growthOf(o, a.accountId))}</dd></div>
                <div><dt className="text-muted">Просмотры</dt><dd className="tabular-nums">{fmtInt(a.periodViews)}</dd></div>
                <div><dt className="text-muted">Реакции</dt><dd className="tabular-nums">{fmtInt(a.periodReactions)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Подписчики — накопленный прирост</h2>
          <span className="text-xs text-muted">день ко дню за {period} дней</span>
        </div>
        <GrowthChart data={o.growth} series={series} />
      </section>
    </div>
  );
}

function growthOf(o: Awaited<ReturnType<typeof getOverview>>, accountId: string): number | null {
  const last = [...o.growth].reverse().find((g) => typeof g[accountId] === "number");
  return last ? (last[accountId] as number) : null;
}
