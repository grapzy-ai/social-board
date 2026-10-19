import { and, eq, gte, sql } from "drizzle-orm";
import { posts, postMetricsSnapshots, benchmarks, POST_FORMATS, type PostFormat } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { computeBenchmark, median, MIN_BENCHMARK_SAMPLE } from "./benchmarks";
import { chisinauDate, dayIndex } from "@/lib/time";
import { MULTIPLIER_DAY } from "./multiplier";

export interface BenchmarkRow {
  accountId: string;
  format: PostFormat;
  medianViews: number | null;
  medianComments: number | null;
  medianSaves: number | null;
  sampleSize: number;
  provisional: boolean;
}

/**
 * For each (account, format): median of day-11 views over the last `periodDays`.
 * If fewer than MIN_BENCHMARK_SAMPLE posts have a day-11 snapshot but >= MIN posts are at least 11 days old,
 * fall back to each post's latest snapshot and mark the benchmark provisional.
 */
export async function computeBenchmarkRows(db: AnyDb, accountId: string, now: Date, periodDays = 90): Promise<BenchmarkRow[]> {
  const since = new Date(now.getTime() - periodDays * 86_400_000);
  const rows = await db
    .select({
      postId: posts.id,
      format: posts.format,
      publishedAt: posts.publishedAt,
      dayIndex: postMetricsSnapshots.dayIndex,
      views: postMetricsSnapshots.views,
      comments: postMetricsSnapshots.comments,
      saves: postMetricsSnapshots.saves,
    })
    .from(posts)
    .leftJoin(postMetricsSnapshots, eq(postMetricsSnapshots.postId, posts.id))
    .where(and(eq(posts.accountId, accountId), gte(posts.publishedAt, since)));

  type Snap = { dayIndex: number; views: number | null; comments: number | null; saves: number | null };
  const byPost = new Map<string, { format: PostFormat; publishedAt: Date; snaps: Snap[] }>();
  for (const r of rows) {
    const entry = byPost.get(r.postId) ?? { format: r.format, publishedAt: r.publishedAt, snaps: [] };
    if (r.dayIndex !== null) entry.snaps.push({ dayIndex: r.dayIndex, views: r.views, comments: r.comments, saves: r.saves });
    byPost.set(r.postId, entry);
  }

  const out: BenchmarkRow[] = [];
  for (const format of POST_FORMATS) {
    const ofFormat = [...byPost.values()].filter((p) => p.format === format);
    if (ofFormat.length === 0) continue;
    const day11 = ofFormat.map((p) => p.snaps.find((s) => s.dayIndex === MULTIPLIER_DAY) ?? null).filter((s): s is Snap => s !== null);
    let sample: Snap[] = day11;
    let provisional = false;
    if (day11.length < MIN_BENCHMARK_SAMPLE) {
      const matured = ofFormat.filter((p) => dayIndex(p.publishedAt, now) >= MULTIPLIER_DAY && p.snaps.length > 0);
      if (matured.length >= MIN_BENCHMARK_SAMPLE) {
        sample = matured.map((p) => p.snaps.reduce((a, b) => (b.dayIndex > a.dayIndex ? b : a)));
        provisional = true;
      }
    }
    const nums = (k: keyof Snap) => sample.map((s) => s[k] as number | null);
    const medianViews = computeBenchmark(nums("views"));
    out.push({
      accountId,
      format,
      medianViews,
      medianComments: medianViews === null ? null : median(nums("comments").filter((v): v is number => v !== null)),
      medianSaves: medianViews === null ? null : median(nums("saves").filter((v): v is number => v !== null)),
      sampleSize: medianViews === null ? 0 : sample.length,
      provisional: medianViews !== null && provisional,
    });
  }
  return out;
}

export async function recomputeBenchmarks(db: AnyDb, accountIds: string[], now = new Date()): Promise<number> {
  let written = 0;
  for (const accountId of accountIds) {
    const rowsForAccount = await computeBenchmarkRows(db, accountId, now);
    for (const r of rowsForAccount) {
      await db
        .insert(benchmarks)
        .values({ ...r, computedAt: now, computedOn: chisinauDate(now) })
        .onConflictDoUpdate({
          target: [benchmarks.accountId, benchmarks.format, benchmarks.computedOn],
          set: { medianViews: r.medianViews, medianComments: r.medianComments, medianSaves: r.medianSaves, sampleSize: r.sampleSize, provisional: r.provisional, computedAt: now },
        });
      written += 1;
    }
  }
  return written;
}

/** Latest benchmark per (account, format). */
export async function latestBenchmarks(db: AnyDb): Promise<Map<string, { medianViews: number | null; provisional: boolean }>> {
  const rows = await db
    .select()
    .from(benchmarks)
    .orderBy(sql`${benchmarks.computedOn} desc`);
  const map = new Map<string, { medianViews: number | null; provisional: boolean }>();
  for (const r of rows) {
    const k = `${r.accountId}:${r.format}`;
    if (!map.has(k)) map.set(k, { medianViews: r.medianViews, provisional: r.provisional });
  }
  return map;
}
