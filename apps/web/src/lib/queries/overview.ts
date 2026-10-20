import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { accounts, accountMetricsDaily, goals, posts, postMetricsSnapshots, signals, type Platform } from "@/lib/db/schema";
import { latestBenchmarks } from "@/lib/metrics/recompute-benchmarks";
import { multiplier, pickMultiplierSnapshot } from "@/lib/metrics/multiplier";
import type { AnyDb } from "@/lib/db/types";
import { chisinauDate, chisinauDayBounds } from "@/lib/time";
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
  /** Cumulative follower delta per calendar day for the 7 days ending `period.to`; null where no row. */
  spark: Array<number | null>;
  /** Goal pace; null without a goal. */
  pace: { needPerDay: number | null; actualPerDay7: number | null; forecastEnd: number | null } | null;
}

export interface PostBrief {
  id: string;
  accountId: string;
  platform: Platform;
  language: "ru" | "en";
  text: string | null;
  multiplier: number;
  views: number | null;
}

export interface SignalBrief {
  id: string;
  type: string;
  createdAt: Date;
  handle: string | null;
}

export interface Overview {
  period: PeriodSpec;
  accounts: AccountCard[];
  growth: Array<{ date: string } & Record<string, number | string>>;
  top: PostBrief[];
  bottom: PostBrief[];
  signals: SignalBrief[];
}

const SPARK_DAYS = 7;

function daysLeftInMonth(today: string): number {
  const [y, m, d] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.max(1, last - d);
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
  if (accs.length === 0) return { period, accounts: [], growth: [], top: [], bottom: [], signals: [] };
  const ids = accs.map((a) => a.id);

  const sparkStart = addDays(periodEnd, -(SPARK_DAYS - 1));
  const paceStart = addDays(today, -7);
  const lower = [periodStart, sparkStart, paceStart].sort()[0];
  const dailyAll = await db
    .select()
    .from(accountMetricsDaily)
    .where(and(inArray(accountMetricsDaily.accountId, ids), gte(accountMetricsDaily.date, lower), lte(accountMetricsDaily.date, today)))
    .orderBy(accountMetricsDaily.date);
  const daily = dailyAll.filter((d) => d.date >= periodStart && d.date <= periodEnd);

  const goalRows = await db.select().from(goals).where(and(inArray(goals.accountId, ids), eq(goals.month, monthStart), eq(goals.metric, "followers")));

  // posts published inside the period (Chisinau calendar days → UTC bounds are approximate by design)
  const since = chisinauDayBounds(periodStart).start;
  const until = chisinauDayBounds(periodEnd).end;
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
  for (const d of dailyAll) {
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

    // sparkline: cumulative delta vs the first known value inside the 7-day window
    const sparkDates = Array.from({ length: SPARK_DAYS }, (_, i) => addDays(sparkStart, i));
    let sparkBase: number | null = null;
    const spark = sparkDates.map((d) => {
      const v = f(d);
      if (v === null) return null;
      if (sparkBase === null) sparkBase = v;
      return v - sparkBase;
    });

    let pace: AccountCard["pace"] = null;
    if (g) {
      const left = daysLeftInMonth(today);
      const weekAgo = f(paceStart);
      const needPerDay = followers === null ? null : (g.target - followers) / left;
      const actualPerDay7 = followers !== null && weekAgo !== null ? (followers - weekAgo) / 7 : null;
      const forecastEnd = followers !== null && weekAgo !== null ? Math.round(followers + ((followers - weekAgo) / 7) * left) : null;
      pace = { needPerDay, actualPerDay7, forecastEnd };
    }
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
      spark,
      pace,
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
  // top / anti-top of the period by multiplier (latest snapshot ≤ day 11, provisional fallback)
  const bench = await latestBenchmarks(db);
  const snapsByPost = new Map<string, typeof snapRows>();
  for (const r of snapRows) snapsByPost.set(r.postId, [...(snapsByPost.get(r.postId) ?? []), r]);
  const postMeta = new Map(
    (await db
      .select({ id: posts.id, accountId: posts.accountId, format: posts.format, text: posts.text, language: posts.language })
      .from(posts)
      .where(inArray(posts.id, [...snapsByPost.keys()].length ? [...snapsByPost.keys()] : ["00000000-0000-0000-0000-000000000000"]))).map((p) => [p.id, p]),
  );
  const accById = new Map(accs.map((a) => [a.id, a]));
  const ranked: PostBrief[] = [];
  for (const [postId, snaps] of snapsByPost) {
    const meta = postMeta.get(postId);
    const acc = meta && accById.get(meta.accountId);
    if (!meta || !acc) continue;
    const { snap } = pickMultiplierSnapshot(snaps);
    const m = multiplier(snap?.views ?? null, bench.get(`${meta.accountId}:${meta.format}`)?.medianViews ?? null);
    if (m === null) continue;
    ranked.push({ id: postId, accountId: acc.id, platform: acc.platform, language: meta.language, text: meta.text, multiplier: m, views: snap?.views ?? null });
  }
  ranked.sort((a, b) => b.multiplier - a.multiplier);
  const top = ranked.slice(0, 3);
  // lowest 3; may overlap with `top` when fewer than 6 posts have a multiplier — the UI decides what to show
  const bottom = [...ranked].reverse().slice(0, 3);

  const sigRows = await db
    .select({ id: signals.id, type: signals.type, createdAt: signals.createdAt, accountId: signals.accountId })
    .from(signals)
    .where(and(eq(signals.status, "new"), inArray(signals.accountId, ids)))
    .orderBy(desc(signals.createdAt))
    .limit(5);
  const sigs: SignalBrief[] = sigRows.map((r) => ({ id: r.id, type: r.type, createdAt: r.createdAt, handle: r.accountId ? (accById.get(r.accountId)?.handle ?? null) : null }));

  return { period, accounts: cards, growth, top, bottom, signals: sigs };
}

function latestKnown(m: Map<string, number | null>): number | null {
  let best: string | null = null;
  for (const [date, v] of m) if (v !== null && (best === null || date > best)) best = date;
  return best ? (m.get(best) ?? null) : null;
}
