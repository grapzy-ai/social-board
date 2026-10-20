import { eq } from "drizzle-orm";
import { accounts, type Platform } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { runSync, type SyncResult } from "./run";

/** Platforms the web app can pull itself; everything else is a worker or manual feed. */
export const API_PLATFORMS: readonly Platform[] = ["threads", "instagram"];
const WORKER_PLATFORMS: readonly Platform[] = ["telegram"];

export type SkipReason = "worker" | "paused" | "no_api";

export interface SegmentSyncReport {
  results: SyncResult[];
  skipped: Array<{ accountId: string; platform: Platform; reason: SkipReason }>;
}

/** On-demand sync of a segment ("ru" | "en" | undefined = all): sequential, one result per API account. */
export async function syncSegment(
  db: AnyDb,
  language: "ru" | "en" | undefined,
  opts: { now?: Date; runner?: (accountId: string, o: { db: AnyDb; now?: Date }) => Promise<SyncResult> } = {},
): Promise<SegmentSyncReport> {
  const runner = opts.runner ?? runSync;
  const rows = await db
    .select({ id: accounts.id, platform: accounts.platform, status: accounts.status })
    .from(accounts)
    .where(language ? eq(accounts.language, language) : undefined)
    .orderBy(accounts.platform, accounts.handle);

  const report: SegmentSyncReport = { results: [], skipped: [] };
  for (const a of rows) {
    if (WORKER_PLATFORMS.includes(a.platform)) report.skipped.push({ accountId: a.id, platform: a.platform, reason: "worker" });
    else if (!API_PLATFORMS.includes(a.platform)) report.skipped.push({ accountId: a.id, platform: a.platform, reason: "no_api" });
    else if (a.status !== "active") report.skipped.push({ accountId: a.id, platform: a.platform, reason: "paused" });
    else report.results.push(await runner(a.id, { db, now: opts.now }));
  }
  return report;
}
