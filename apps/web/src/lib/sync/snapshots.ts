import { eq } from "drizzle-orm";
import { postMetricsSnapshots } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { NormalizedPostMetrics } from "@/lib/adapters/types";
import { shouldSnapshot } from "@/lib/time";

export { shouldSnapshot };

export async function existingSnapshotDays(db: AnyDb, postId: string): Promise<number[]> {
  const rows = await db
    .select({ dayIndex: postMetricsSnapshots.dayIndex })
    .from(postMetricsSnapshots)
    .where(eq(postMetricsSnapshots.postId, postId));
  return rows.map((r) => r.dayIndex);
}

/** Append-only: inserts a snapshot; a duplicate (post, day) is ignored. Returns true when written. */
export async function writeSnapshot(db: AnyDb, postId: string, dayIndex: number, m: NormalizedPostMetrics, capturedAt: Date): Promise<boolean> {
  const inserted = await db
    .insert(postMetricsSnapshots)
    .values({ postId, dayIndex, capturedAt, ...m })
    .onConflictDoNothing({ target: [postMetricsSnapshots.postId, postMetricsSnapshots.dayIndex] })
    .returning({ id: postMetricsSnapshots.id });
  return inserted.length > 0;
}
