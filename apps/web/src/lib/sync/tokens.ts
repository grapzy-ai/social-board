import { eq } from "drizzle-orm";
import { accounts, signals, type Account, type Platform } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { Adapter } from "@/lib/adapters/types";
import { encryptToken } from "@/lib/crypto";
import { adapterFor } from "./run";

export const REFRESH_WHEN_DAYS_LEFT = 10;

export interface AddAccountInput {
  platform: Platform;
  handle: string;
  externalUserId: string | null;
  language: "ru" | "en";
  role: "focus" | "mirror" | "lifestyle";
  token: string | null;
  expiresAt: Date | null;
}

/** Upsert by (platform, handle); token stored encrypted; status reset to active. */
export async function addAccount(db: AnyDb, input: AddAccountInput): Promise<Account> {
  const tokenEnc = input.token ? encryptToken(input.token) : null;
  const now = new Date();
  const [row] = await db
    .insert(accounts)
    .values({
      platform: input.platform,
      handle: input.handle,
      externalUserId: input.externalUserId,
      language: input.language,
      role: input.role,
      tokenEnc,
      tokenExpiresAt: input.expiresAt,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [accounts.platform, accounts.handle],
      set: {
        externalUserId: input.externalUserId,
        language: input.language,
        role: input.role,
        ...(tokenEnc ? { tokenEnc, tokenExpiresAt: input.expiresAt, status: "active" as const } : {}),
        updatedAt: now,
      },
    })
    .returning();
  return row;
}

export type RefreshOutcome = "skipped" | "refreshed" | "failed";

export async function refreshIfNeeded(db: AnyDb, account: Account, opts: { now?: Date; adapter?: Adapter } = {}): Promise<RefreshOutcome> {
  const now = opts.now ?? new Date();
  if (!account.tokenEnc || !account.tokenExpiresAt) return "skipped";
  const daysLeft = (account.tokenExpiresAt.getTime() - now.getTime()) / 86_400_000;
  if (daysLeft > REFRESH_WHEN_DAYS_LEFT) return "skipped";
  try {
    const adapter = opts.adapter ?? adapterFor(account);
    const r = await adapter.refreshToken();
    await db
      .update(accounts)
      .set({ tokenEnc: encryptToken(r.token), tokenExpiresAt: r.expiresAt, status: "active", updatedAt: now })
      .where(eq(accounts.id, account.id));
    return "refreshed";
  } catch (e) {
    await db.insert(signals).values({
      accountId: account.id,
      type: "token_expiring",
      payload: { daysLeft: Math.round(daysLeft), error: e instanceof Error ? e.message : String(e) },
    });
    return "failed";
  }
}
