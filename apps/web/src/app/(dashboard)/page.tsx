import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getOverview, type Overview, type PostBrief } from "@/lib/queries/overview";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { resolvePeriod } from "@/lib/ui/period";
import { chisinauDate } from "@/lib/time";
import { accountColor, fmtInt, PLATFORM_LABEL } from "@/lib/ui/platform";
import { PageHeader } from "@/components/shell/PageHeader";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { GrowthChart } from "@/components/charts/GrowthChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { PlatformChip } from "@/components/ui/PlatformChip";
import { Delta } from "@/components/ui/Delta";
import { Multiplier } from "@/components/ui/Multiplier";

export const dynamic = "force-dynamic";
// «Обновить» runs the segment sync inside this route's server action; give it the cron's budget.
export const maxDuration = 300;

const SIGNAL_TEXT: Record<string, string> = {
  token_expired: "токен истёк — нужна повторная авторизация",
  token_expiring: "токен скоро истечёт",
  sync_failing: "сборщик падает несколько раз подряд",
  post_x3_24h: "пост ×3 к медиане за сутки",
  repeated_question: "повторяющийся вопрос в комментариях",
  week_drop: "просадка недели",
  day11_due: "11-й день поста — зафиксируй результат",
  goal_behind: "цель месяца отстаёт от темпа",
};

const fmt1 = (n: number | null) => (n === null ? "—" : (Math.round(n * 10) / 10).toLocaleString("ru-RU"));

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const segment = resolveSegment((await cookies()).get(SEGMENT_COOKIE)?.value);
  const now = new Date();
  const spec = resolvePeriod(sp, chisinauDate(now));
  const o = await getOverview(getDb(), spec, now, segmentLanguage(segment));
  const showLang = segment === "all";

  const perPlatformIndex = new Map<string, number>();
  const series = o.accounts.map((a) => {
    const key = `${a.platform}:${a.language}`;
    const i = perPlatformIndex.get(key) ?? 0;
    perPlatformIndex.set(key, i + 1);
    return { key: a.accountId, label: `${PLATFORM_LABEL[a.platform]}${showLang && a.language === "en" ? " EN" : ""}`, color: accountColor(a.platform, a.language, i) };
  });
  const colorOf = Object.fromEntries(series.map((s) => [s.key, s.color]));
  const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(now);
  const back = spec.preset ? `/?period=${spec.preset}` : `/?from=${spec.from}&to=${spec.to}`;
  const showBottom = o.top.length + o.bottom.length > 3 && o.bottom.some((b) => !o.top.some((t) => t.id === b.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Обзор"
        spec={spec}
        basePath="/"
        actions={
          <>
            <RefreshButton back={back} />
            <Link href="/share" className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-fg">Поделиться</Link>
          </>
        }
      />
      {sp.refreshed && <p className="-mt-3 text-xs text-muted">Обновлено: {sp.refreshed} аккаунтов синхронизировано.</p>}

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted">Аккаунты · цели на {monthName}</h2>
        {o.accounts.length === 0 && (
          <p className="card p-5 text-sm text-muted">
            В сегменте нет аккаунтов. <Link className="text-accent" href="/settings/accounts">Подключить →</Link>
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {o.accounts.map((a) => (
            <article key={a.accountId} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <PlatformChip platform={a.platform} language={a.language} handle={a.handle} color={colorOf[a.accountId]} showLang={showLang} />
                <Sparkline values={a.spark} color={colorOf[a.accountId]} />
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold tabular-nums tracking-tight">{fmtInt(a.followers)}</span>
                <span className="text-xs text-muted">подписчиков</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted">вчера</div><Delta value={a.deltaYesterday} /></div>
                <div><div className="text-muted">сегодня</div><Delta value={a.deltaToday} /></div>
                <div><div className="text-muted">за период</div><Delta value={growthOf(o, a.accountId)} /></div>
              </div>
              {a.goal ? (
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-muted">цель {fmtInt(a.goal.target)}</span>
                    <span className="tabular-nums">{a.goal.progressPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-line">
                    <div className="h-full rounded" style={{ width: `${Math.min(100, a.goal.progressPct)}%`, background: colorOf[a.accountId] }} />
                  </div>
                  {a.pace && (
                    <p className="mt-1.5 text-xs text-muted">
                      нужно <b className="text-fg">+{fmt1(a.pace.needPerDay)}</b>/день · идёшь <b className={a.pace.actualPerDay7 !== null && a.pace.needPerDay !== null && a.pace.actualPerDay7 >= a.pace.needPerDay ? "text-good" : "text-fg"}>+{fmt1(a.pace.actualPerDay7)}</b>/день · прогноз <b className="text-fg">{fmtInt(a.pace.forecastEnd)}</b>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Цель не задана — <Link className="text-accent" href="/settings/accounts">задать</Link>
                </p>
              )}
              {a.comment && <p className="text-sm leading-snug">{a.comment}</p>}
              <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
                <div><dt className="text-muted">Просмотры за период</dt><dd className="tabular-nums">{fmtInt(a.periodViews)}</dd></div>
                <div><dt className="text-muted">Реакции</dt><dd className="tabular-nums">{fmtInt(a.periodReactions)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Подписчики — накопленный прирост</h2>
          <span className="text-xs text-muted">{spec.days} дн · {spec.from.slice(8, 10)}.{spec.from.slice(5, 7)} — {spec.to.slice(8, 10)}.{spec.to.slice(5, 7)}</span>
        </div>
        <GrowthChart data={o.growth} series={series} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <PostList title="Топ периода" items={o.top} colorOf={colorOf} showLang={showLang} empty="Пока нет постов с множителем — нужны ≥5 постов формата с 11-дневным снимком." />
        {showBottom ? (
          <PostList title="Мимо" items={o.bottom.filter((b) => !o.top.some((t) => t.id === b.id))} colorOf={colorOf} showLang={showLang} empty="—" />
        ) : (
          <div className="card p-5 text-sm text-muted">«Мимо» появится, когда наберётся больше постов с множителем.</div>
        )}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-medium">Сигналы</h2>
          {o.signals.length === 0 ? (
            <p className="text-sm text-muted">Тишина — ничего не требует внимания.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {o.signals.map((s) => (
                <li key={s.id} className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    {SIGNAL_TEXT[s.type] ?? s.type}
                    {s.handle && <span className="text-muted"> · @{s.handle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function PostList({ title, items, colorOf, showLang, empty }: { title: string; items: PostBrief[]; colorOf: Record<string, string>; showLang: boolean; empty: string }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id} className="flex items-start gap-3">
              <Multiplier value={p.multiplier} />
              <div className="min-w-0">
                <Link href={`/posts/${p.id}`} className="line-clamp-2 text-sm hover:text-accent">{p.text ?? "—"}</Link>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf[p.accountId] ?? "var(--muted)" }} />
                  {PLATFORM_LABEL[p.platform]}{showLang && p.language === "en" ? " EN" : ""} · {fmtInt(p.views)} просм.
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function growthOf(o: Overview, accountId: string): number | null {
  const last = [...o.growth].reverse().find((g) => typeof g[accountId] === "number");
  return last ? (last[accountId] as number) : null;
}
