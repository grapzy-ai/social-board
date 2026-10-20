import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { accounts, accountMetricsDaily, posts, postMetricsSnapshots } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { PeriodSpec } from "@/lib/ui/period";
import { computeShare, type ShareStats } from "./compute";

export const SHARE_HANDLE: Record<"ru" | "en" | "all", string> = { ru: "vadimbordian", en: "vadim.bordian", all: "vadim.bordian" };

export async function getShareStats(db: AnyDb, language: "ru" | "en" | undefined, spec: PeriodSpec): Promise<ShareStats & { handle: string }> {
  const handle = SHARE_HANDLE[language ?? "all"];
  const accs = await db
    .select({ id: accounts.id, platform: accounts.platform, language: accounts.language, handle: accounts.handle })
    .from(accounts)
    .where(language ? eq(accounts.language, language) : undefined)
    .orderBy(accounts.platform, accounts.handle);
  if (accs.length === 0) return { ...computeShare({ accounts: [], daily: [], views: [], from: spec.from, to: spec.to }), handle };
  const ids = accs.map((a) => a.id);

  const daily = await db
    .select({ accountId: accountMetricsDaily.accountId, date: accountMetricsDaily.date, followers: accountMetricsDaily.followers })
    .from(accountMetricsDaily)
    .where(and(inArray(accountMetricsDaily.accountId, ids), gte(accountMetricsDaily.date, spec.from), lte(accountMetricsDaily.date, spec.to)));

  const snaps = await db
    .select({ accountId: posts.accountId, postId: posts.id, dayIndex: postMetricsSnapshots.dayIndex, views: postMetricsSnapshots.views })
    .from(posts)
    .innerJoin(postMetricsSnapshots, eq(postMetricsSnapshots.postId, posts.id))
    .where(and(inArray(posts.accountId, ids), gte(posts.publishedAt, new Date(spec.from + "T00:00:00+03:00")), lte(posts.publishedAt, new Date(spec.to + "T23:59:59+03:00"))));
  const latest = new Map<string, { accountId: string; dayIndex: number; views: number | null }>();
  for (const s of snaps) {
    const cur = latest.get(s.postId);
    if (!cur || s.dayIndex > cur.dayIndex) latest.set(s.postId, s);
  }
  const viewsByAcc = new Map<string, number>();
  for (const s of latest.values()) viewsByAcc.set(s.accountId, (viewsByAcc.get(s.accountId) ?? 0) + (s.views ?? 0));

  return {
    ...computeShare({ accounts: accs, daily, views: [...viewsByAcc].map(([accountId, views]) => ({ accountId, views })), from: spec.from, to: spec.to }),
    handle,
  };
}
