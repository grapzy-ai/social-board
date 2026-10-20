import { eq } from "drizzle-orm";
import { accounts, accountMetricsDaily, manualMetrics } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";

export interface ManualMetricsInput {
  accountId: string;
  /** YYYY-MM-DD (Chisinau calendar day) */
  date: string;
  followers: number | null;
  views: number | null;
  note?: string | null;
}

/** Hand-entered numbers (LinkedIn and anything without an API): kept in manual_metrics and mirrored into the daily series the Overview reads. */
export async function recordManualMetrics(db: AnyDb, input: ManualMetricsInput, now = new Date()): Promise<void> {
  await db
    .insert(manualMetrics)
    .values({ accountId: input.accountId, date: input.date, followers: input.followers, views: input.views, note: input.note ?? null })
    .onConflictDoUpdate({
      target: [manualMetrics.accountId, manualMetrics.date],
      set: { followers: input.followers, views: input.views, note: input.note ?? null },
    });
  if (input.followers !== null) {
    await db
      .insert(accountMetricsDaily)
      .values({ accountId: input.accountId, date: input.date, followers: input.followers, capturedAt: now })
      .onConflictDoUpdate({ target: [accountMetricsDaily.accountId, accountMetricsDaily.date], set: { followers: input.followers, capturedAt: now } });
  }
  await db.update(accounts).set({ lastOkSyncAt: now, updatedAt: now }).where(eq(accounts.id, input.accountId));
}
