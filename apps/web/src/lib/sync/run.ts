import { and, desc, eq, sql } from "drizzle-orm";
import { accounts, posts, accountMetricsDaily, signals, syncRuns, type Account } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { Adapter } from "@/lib/adapters/types";
import { ThreadsAdapter } from "@/lib/adapters/threads";
import { InstagramAdapter } from "@/lib/adapters/instagram";
import { MetaApiError } from "@/lib/adapters/meta-http";
import { decryptToken } from "@/lib/crypto";
import { chisinauDate, dayIndex } from "@/lib/time";
import { existingSnapshotDays, shouldSnapshot, writeSnapshot } from "./snapshots";

export interface SyncResult {
  accountId: string;
  postsUpserted: number;
  snapshotsWritten: number;
  /** ok — everything written; partial — some posts failed, the rest written; error — nothing usable (auth/list failure). */
  status: "ok" | "partial" | "error";
  error?: string;
}

export const SYNC_LOOKBACK_DAYS = 90;
/** Consecutive failed runs after which a `sync_failing` signal is raised. */
export const SYNC_FAILING_THRESHOLD = 3;

export function adapterFor(account: Account): Adapter {
  if (!account.tokenEnc || !account.externalUserId) throw new Error(`Account ${account.id} has no token or external id`);
  const token = decryptToken(account.tokenEnc);
  switch (account.platform) {
    case "threads":
      return new ThreadsAdapter({ userId: account.externalUserId, token });
    case "instagram":
      return new InstagramAdapter({ igId: account.externalUserId, token });
    default:
      throw new Error(`No API adapter for platform ${account.platform}`);
  }
}

export interface RunSyncOptions {
  db: AnyDb;
  now?: Date;
  adapter?: Adapter;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isAuthError = (e: unknown) => e instanceof MetaApiError && e.isAuth;

export async function runSync(accountId: string, opts: RunSyncOptions): Promise<SyncResult> {
  const { db } = opts;
  const now = opts.now ?? new Date();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) throw new Error(`Account ${accountId} not found`);
  const startedAt = now;
  const result: SyncResult = { accountId, postsUpserted: 0, snapshotsWritten: 0, status: "ok" };
  const errors: string[] = [];

  try {
    const adapter = opts.adapter ?? adapterFor(account);
    const since = new Date(now.getTime() - SYNC_LOOKBACK_DAYS * 86_400_000);
    const list = await adapter.listPosts(since);

    // Each post is its own unit of work: a bad post never rolls back its neighbours. Auth errors abort the run.
    for (const p of list) {
      let postId: string;
      try {
        const [row] = await db
          .insert(posts)
          .values({
            accountId,
            externalId: p.externalId,
            format: p.format,
            publishedAt: p.publishedAt,
            text: p.text,
            mediaUrl: p.mediaUrl,
            permalink: p.permalink,
            language: account.language,
          })
          .onConflictDoUpdate({
            target: [posts.accountId, posts.externalId],
            set: { text: p.text, mediaUrl: p.mediaUrl, permalink: p.permalink, format: p.format, updatedAt: now },
          })
          .returning({ id: posts.id });
        postId = row.id;
        result.postsUpserted += 1;
      } catch (e) {
        errors.push(`${p.externalId}: upsert: ${msg(e)}`);
        continue;
      }

      try {
        const dayIdx = dayIndex(p.publishedAt, now);
        const existing = await existingSnapshotDays(db, postId);
        // A post with no snapshots yet (first seen late) gets a first-seen snapshot at the current day index.
        if (existing.length === 0 || shouldSnapshot(dayIdx, existing)) {
          const m = await adapter.postMetrics(p.externalId, p.format);
          if (await writeSnapshot(db, postId, dayIdx, m, now)) result.snapshotsWritten += 1;
        }
      } catch (e) {
        if (isAuthError(e)) throw e;
        errors.push(`${p.externalId}: ${msg(e)}`);
      }
    }

    try {
      const am = await adapter.accountMetrics();
      await db
        .insert(accountMetricsDaily)
        .values({ accountId, date: chisinauDate(now), followers: am.followers, profileViews: am.profileViews, reach: am.reach, capturedAt: now })
        .onConflictDoUpdate({
          target: [accountMetricsDaily.accountId, accountMetricsDaily.date],
          set: { followers: am.followers, profileViews: am.profileViews, reach: am.reach, capturedAt: now },
        });
    } catch (e) {
      if (isAuthError(e)) throw e;
      errors.push(`account_metrics: ${msg(e)}`);
    }

    await db.update(accounts).set({ lastOkSyncAt: now, updatedAt: now }).where(eq(accounts.id, accountId));
    if (errors.length) {
      result.status = "partial";
      result.error = errors.join("; ").slice(0, 2000);
    }
  } catch (e) {
    result.status = "error";
    result.error = [msg(e), ...errors].join("; ").slice(0, 2000);
    if (isAuthError(e)) {
      const err = e as MetaApiError;
      await db.update(accounts).set({ status: "token_invalid", updatedAt: now }).where(eq(accounts.id, accountId));
      await db.insert(signals).values({ accountId, type: "token_expired", payload: { message: err.message, status: err.status } });
    }
  }

  await db.insert(syncRuns).values({
    accountId,
    startedAt,
    finishedAt: sql`now()`,
    status: result.status,
    postsUpserted: result.postsUpserted,
    snapshotsWritten: result.snapshotsWritten,
    error: result.error ?? null,
  });

  if (result.status === "error") await raiseSyncFailingIfNeeded(db, accountId, now);
  return result;
}

/** After SYNC_FAILING_THRESHOLD consecutive error runs, raise one open `sync_failing` signal (no duplicates while one is `new`). */
async function raiseSyncFailingIfNeeded(db: AnyDb, accountId: string, now: Date) {
  const recent = await db
    .select({ status: syncRuns.status })
    .from(syncRuns)
    .where(eq(syncRuns.accountId, accountId))
    .orderBy(desc(syncRuns.startedAt), desc(syncRuns.id))
    .limit(SYNC_FAILING_THRESHOLD);
  if (recent.length < SYNC_FAILING_THRESHOLD || !recent.every((r) => r.status === "error")) return;
  const open = await db
    .select({ id: signals.id })
    .from(signals)
    .where(and(eq(signals.accountId, accountId), eq(signals.type, "sync_failing"), eq(signals.status, "new")))
    .limit(1);
  if (open.length) return;
  await db.insert(signals).values({ accountId, type: "sync_failing", payload: { consecutiveFailures: SYNC_FAILING_THRESHOLD, at: now.toISOString() } });
}
