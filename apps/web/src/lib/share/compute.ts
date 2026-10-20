import type { Platform } from "@/lib/db/schema";
import { accountColor } from "@/lib/ui/platform";

export interface ShareInput {
  accounts: Array<{ id: string; platform: Platform; language: "ru" | "en"; handle: string }>;
  daily: Array<{ accountId: string; date: string; followers: number | null }>;
  /** Sum of latest-snapshot views per account for posts published inside the range. */
  views: Array<{ accountId: string; views: number }>;
  from: string;
  to: string;
}

export interface SharePlatform {
  accountId: string;
  platform: Platform;
  language: "ru" | "en";
  handle: string;
  delta: number | null;
  pct: number | null;
  color: string;
}

export interface ShareStats {
  from: string;
  to: string;
  days: number;
  totalDelta: number | null;
  totalPct: number | null;
  totalViews: number;
  perPlatform: SharePlatform[];
  /** One row per calendar day; `stacked[i]` = running sum of cumulative deltas of perPlatform[0..i]. */
  series: Array<{ date: string; stacked: number[] }>;
  hasData: boolean;
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pure share-card statistics. delta = last − first known followers in range (null with <2 rows); pct vs first (null when first is 0). */
export function computeShare(i: ShareInput): ShareStats {
  const days = Math.max(1, Math.round((Date.parse(i.to + "T00:00:00Z") - Date.parse(i.from + "T00:00:00Z")) / 86_400_000) + 1);
  const dates = Array.from({ length: days }, (_, k) => addDays(i.from, k));

  const byAcc = new Map<string, Map<string, number>>();
  for (const d of i.daily) {
    if (d.followers === null || d.date < i.from || d.date > i.to) continue;
    if (!byAcc.has(d.accountId)) byAcc.set(d.accountId, new Map());
    byAcc.get(d.accountId)!.set(d.date, d.followers);
  }
  const viewsByAcc = new Map(i.views.map((v) => [v.accountId, v.views]));

  const slotIndex = new Map<string, number>();
  const perPlatform: SharePlatform[] = [];
  const cumulative: number[][] = []; // per account, per date (carried forward, 0 before first value)
  let firstSum = 0; // sum of first values of accounts that have a delta
  let pctPossible = true; // false when any delta-bearing account starts from 0 (percent would be infinite)
  let anyDelta = false;

  for (const a of i.accounts) {
    const m = byAcc.get(a.id) ?? new Map<string, number>();
    const known = dates.filter((d) => m.has(d));
    const first = known.length ? m.get(known[0])! : null;
    const last = known.length ? m.get(known[known.length - 1])! : null;
    const delta = known.length >= 2 ? last! - first! : null;
    const pct = delta !== null && first ? round1((delta / first) * 100) : null;
    if (delta !== null) {
      anyDelta = true;
      if (first) firstSum += first;
      else pctPossible = false;
    }

    const key = `${a.platform}:${a.language}`;
    const idx = slotIndex.get(key) ?? 0;
    slotIndex.set(key, idx + 1);
    perPlatform.push({ accountId: a.id, platform: a.platform, language: a.language, handle: a.handle, delta, pct, color: accountColor(a.platform, a.language, idx) });

    let base: number | null = null;
    let lastKnown: number | null = null;
    cumulative.push(
      dates.map((d) => {
        const v = m.get(d);
        if (v !== undefined) {
          if (base === null) base = v;
          lastKnown = v;
        }
        return base === null || lastKnown === null ? 0 : lastKnown - base;
      }),
    );
  }

  const totalDelta = anyDelta ? perPlatform.reduce((s, p) => s + (p.delta ?? 0), 0) : null;
  const totalPct = totalDelta !== null && pctPossible && firstSum > 0 ? round1((totalDelta / firstSum) * 100) : null;
  const totalViews = i.accounts.reduce((s, a) => s + (viewsByAcc.get(a.id) ?? 0), 0);
  const series = dates.map((date, k) => {
    let run = 0;
    return { date, stacked: cumulative.map((c) => (run += c[k])) };
  });

  return { from: i.from, to: i.to, days, totalDelta, totalPct, totalViews, perPlatform, series, hasData: anyDelta };
}
