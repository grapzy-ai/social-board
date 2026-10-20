import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { accounts, accountMetricsDaily, goals, posts, postMetricsSnapshots, type Platform } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { chisinauDate } from "@/lib/time";
import type { PeriodSpec } from "@/lib/ui/period";


export interface AccountCard {
  accountId: string;
  platform: Platform;
  handle: string;
  language: "ru" | "en";
  followers: number | null;
  deltaYesterday: number | null;
  deltaToday: number | null;
  goal: { target: number; progressPct: number } | null;
  periodViews: number;
  periodReactions: number;
  comment: string | null;
}

export interface Overview {
  period: PeriodSpec;
  accounts: AccountCard[];
  growth: Array<{ date: string } & Record<string, number | string>>;
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export async function getOverview(db: AnyDb, period: PeriodSpec, now = new Date(), language?: "ru" | "en"): Promise<Overview> {
  const today = chisinauDate(now);
  const yesterday = addDays(today, -1);
  const dayBefore = addDays(today, -2);
  const periodStart = period.from;
  const periodEnd = period.to;
  const monthStart = `${today.slice(0, 7)}-01`;

  const accs = await db
    .select()
    .from(accounts)
    .where(language ? eq(accounts.language, language) : undefined)
    .orderBy(accounts.platform, accounts.handle);
  if (accs.length === 0) return { period, accounts: [], growth: [] };
  const ids = accs.map((a) => a.id);

  const daily = await db
    .select()
    .from(accountMetricsDaily)
    .where(and(inArray(accountMetricsDaily.accountId, ids), gte(accountMetricsDaily.date, periodStart), lte(accountMetricsDaily.date, periodEnd)))
    .orderBy(accountMetricsDaily.date);

  const goalRows = await db.select().from(goals).where(and(inArray(goals.accountId, ids), eq(goals.month, monthStart), eq(goals.metric, "followers")));

  // posts published inside the period (Chisinau calendar days → UTC bounds are approximate by design)
  const since = new Date(periodStart + "T00:00:00+03:00");
  const until = new Date(periodEnd + "T23:59:59+03:00");
  const snapRows = await db
    .select({
      accountId: posts.accountId,
      postId: posts.id,
      dayIndex: postMetricsSnapshots.dayIndex,
      views: postMetricsSnapshots.views,
      likes: postMetricsSnapshots.likes,
      comments: postMetricsSnapshots.comments,
      saves: postMetricsSnapshots.saves,
      reposts: postMetricsSnapshots.reposts,
      shares: postMetricsSnapshots.shares,
    })
    .from(posts)
    .innerJoin(postMetricsSnapshots, eq(postMetricsSnapshots.postId, posts.id))
    .where(and(inArray(posts.accountId, ids), gte(posts.publishedAt, since), lte(posts.publishedAt, until)));

  // latest snapshot per post
  const latest = new Map<string, (typeof snapRows)[number]>();
  for (const r of snapRows) {
    const cur = latest.get(r.postId);
    if (!cur || r.dayIndex > cur.dayIndex) latest.set(r.postId, r);
  }
  const periodTotals = new Map<string, { views: number; reactions: number }>();
  for (const r of latest.values()) {
    const t = periodTotals.get(r.accountId) ?? { views: 0, reactions: 0 };
    t.views += r.views ?? 0;
    t.reactions += (r.likes ?? 0) + (r.comments ?? 0) + (r.saves ?? 0) + (r.reposts ?? 0) + (r.shares ?? 0);
    periodTotals.set(r.accountId, t);
  }

  const byAccountDate = new Map<string, Map<string, number | null>>();
  for (const d of daily) {
    if (!byAccountDate.has(d.accountId)) byAccountDate.set(d.accountId, new Map());
    byAccountDate.get(d.accountId)!.set(d.date, d.followers);
  }

  const cards: AccountCard[] = accs.map((a) => {
    const m = byAccountDate.get(a.id) ?? new Map<string, number | null>();
    const f = (date: string) => m.get(date) ?? null;
    const followers = f(today) ?? f(yesterday) ?? latestKnown(m);
    const deltaToday = f(today) !== null && f(yesterday) !== null ? f(today)! - f(yesterday)! : null;
    const deltaYesterday = f(yesterday) !== null && f(dayBefore) !== null ? f(yesterday)! - f(dayBefore)! : null;
    const g = goalRows.find((x) => x.accountId === a.id);
    const goal = g ? { target: g.target, progressPct: followers === null ? 0 : Math.round((followers / g.target) * 1000) / 10 } : null;
    const totals = periodTotals.get(a.id) ?? { views: 0, reactions: 0 };
    return {
      accountId: a.id,
      platform: a.platform,
      handle: a.handle,
      language: a.language,
      followers,
      deltaYesterday,
      deltaToday,
      goal,
      periodViews: totals.views,
      periodReactions: totals.reactions,
      comment: g?.comment ?? null,
    };
  });

  // cumulative growth: followers(date) − followers(first date with data in period), carried forward
  const dates = [...new Set(daily.map((d) => d.date))].sort();
  const growth: Overview["growth"] = dates.map((date) => ({ date }));
  for (const a of accs) {
    const m = byAccountDate.get(a.id);
    if (!m) continue;
    let base: number | null = null;
    let last: number | null = null;
    for (const row of growth) {
      const v = m.get(row.date) ?? null;
      if (v !== null) {
        if (base === null) base = v;
        last = v;
      }
      if (base !== null && last !== null) row[a.id] = last - base;
    }
  }
  return { period, accounts: cards, growth };
}

function latestKnown(m: Map<string, number | null>): number | null {
  let best: string | null = null;
  for (const [date, v] of m) if (v !== null && (best === null || date > best)) best = date;
  return best ? (m.get(best) ?? null) : null;
}
