import { eq, sql } from "drizzle-orm";
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
  status: "ok" | "error";
  error?: string;
}

export const SYNC_LOOKBACK_DAYS = 90;

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

export async function runSync(accountId: string, opts: RunSyncOptions): Promise<SyncResult> {
  const { db } = opts;
  const now = opts.now ?? new Date();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) throw new Error(`Account ${accountId} not found`);
  const startedAt = now;
  const result: SyncResult = { accountId, postsUpserted: 0, snapshotsWritten: 0, status: "ok" };

  try {
    const adapter = opts.adapter ?? adapterFor(account);
    const since = new Date(now.getTime() - SYNC_LOOKBACK_DAYS * 86_400_000);
    const list = await adapter.listPosts(since);

    await db.transaction(async (tx) => {
      for (const p of list) {
        const [row] = await tx
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
        result.postsUpserted += 1;

        const dayIdx = dayIndex(p.publishedAt, now);
        const existing = await existingSnapshotDays(tx, row.id);
        if (shouldSnapshot(dayIdx, existing)) {
          const m = await adapter.postMetrics(p.externalId, p.format);
          if (await writeSnapshot(tx, row.id, dayIdx, m, now)) result.snapshotsWritten += 1;
        }
      }

      const am = await adapter.accountMetrics();
      await tx
        .insert(accountMetricsDaily)
        .values({ accountId, date: chisinauDate(now), followers: am.followers, profileViews: am.profileViews, reach: am.reach, capturedAt: now })
        .onConflictDoUpdate({
          target: [accountMetricsDaily.accountId, accountMetricsDaily.date],
          set: { followers: am.followers, profileViews: am.profileViews, reach: am.reach, capturedAt: now },
        });

      await tx.update(accounts).set({ lastOkSyncAt: now, updatedAt: now }).where(eq(accounts.id, accountId));
    });
  } catch (e) {
    result.status = "error";
    result.error = e instanceof Error ? e.message : String(e);
    if (e instanceof MetaApiError && e.isAuth) {
      await db.update(accounts).set({ status: "token_invalid", updatedAt: now }).where(eq(accounts.id, accountId));
      await db.insert(signals).values({ accountId, type: "token_expired", payload: { message: e.message, status: e.status } });
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
  return result;
}
