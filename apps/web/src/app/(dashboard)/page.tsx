import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getOverview, type Period } from "@/lib/queries/overview";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { accountColor, fmtDelta, fmtInt, PLATFORM_LABEL } from "@/lib/ui/platform";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = [7, 30, 90];

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const period = (PERIODS.includes(Number(sp.period) as Period) ? Number(sp.period) : 30) as Period;
  const o = await getOverview(getDb(), period);

  const perPlatformIndex = new Map<string, number>();
  const series = o.accounts.map((a) => {
    const i = perPlatformIndex.get(a.platform) ?? 0;
    perPlatformIndex.set(a.platform, i + 1);
    return { key: a.accountId, label: `${PLATFORM_LABEL[a.platform]} ${a.language === "en" ? "EN" : ""}`.trim(), color: accountColor(a.platform, i) };
  });
  const colorOf = Object.fromEntries(series.map((s) => [s.key, s.color]));
  const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(new Date());

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Обзор</h1>
        <div className="flex gap-1 rounded-lg border border-neutral-800 p-1 text-sm">
          {PERIODS.map((p) => (
            <Link key={p} href={`/?period=${p}`} className={`rounded-md px-3 py-1 ${p === period ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"}`}>
              {p} дней
            </Link>
          ))}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm uppercase tracking-wide text-neutral-500">Цели на {monthName}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {o.accounts.length === 0 && (
            <p className="card p-5 text-sm text-neutral-400">
              Аккаунтов нет. <Link className="text-[var(--accent)]" href="/settings/accounts">Подключить →</Link>
            </p>
          )}
          {o.accounts.map((a) => (
            <article key={a.accountId} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorOf[a.accountId] }} />
                  <span className="text-sm font-medium">{PLATFORM_LABEL[a.platform]}{a.language === "en" ? " EN" : ""}</span>
                  <span className="text-xs text-neutral-500">@{a.handle}</span>
                </div>
                <div className="text-right text-xs text-neutral-400">
                  <div>{fmtDelta(a.deltaYesterday)} вчера</div>
                  <div className={a.deltaToday && a.deltaToday > 0 ? "text-[var(--accent)]" : ""}>{fmtDelta(a.deltaToday)} сегодня</div>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{fmtInt(a.followers)}</span>
                {a.goal && <span className="text-sm text-neutral-500">→ {fmtInt(a.goal.target)}</span>}
              </div>
              {a.goal ? (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                    <div className="h-full rounded" style={{ width: `${Math.min(100, a.goal.progressPct)}%`, background: colorOf[a.accountId] }} />
                  </div>
                  <div className="mt-1 text-right text-xs text-neutral-500">{a.goal.progressPct}%</div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-neutral-500">
                  Цель не задана — <Link className="text-[var(--accent)]" href="/settings/accounts">задать</Link>
                </p>
              )}
              {a.comment && <p className="mt-3 text-sm text-neutral-300">{a.comment}</p>}
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-800 pt-3 text-xs">
                <div><dt className="text-neutral-500">За период</dt><dd className="tabular-nums">{fmtDelta(growthOf(o, a.accountId))}</dd></div>
                <div><dt className="text-neutral-500">Просмотры</dt><dd className="tabular-nums">{fmtInt(a.periodViews)}</dd></div>
                <div><dt className="text-neutral-500">Реакции</dt><dd className="tabular-nums">{fmtInt(a.periodReactions)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Подписчики — накопленный прирост</h2>
          <span className="text-xs text-neutral-500">день ко дню за {period} дней</span>
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
