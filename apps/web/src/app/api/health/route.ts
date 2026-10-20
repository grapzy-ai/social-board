import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";

export const runtime = "nodejs";
export const STALE_AFTER_HOURS = 13;

export async function GET() {
  const db = getDb();
  const rows = await db
    .select({ id: accounts.id, platform: accounts.platform, handle: accounts.handle, status: accounts.status, lastOkSyncAt: accounts.lastOkSyncAt })
    .from(accounts)
    .where(eq(accounts.status, "active"));
  const cutoff = Date.now() - STALE_AFTER_HOURS * 3600_000;
  const stale = rows.filter((r) => r.platform !== "linkedin" && (!r.lastOkSyncAt || r.lastOkSyncAt.getTime() < cutoff));
  return Response.json({ ok: stale.length === 0, accounts: rows, stale: stale.map((s) => s.id) }, { status: stale.length === 0 ? 200 : 503 });
}
