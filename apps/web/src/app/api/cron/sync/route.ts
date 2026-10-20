import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { runSync, type SyncResult } from "@/lib/sync/run";
import { isCronAuthorized, unauthorized } from "@/lib/api/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return unauthorized();
  const db = getDb();
  const targets = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.status, "active"), inArray(accounts.platform, ["threads", "instagram"])));
  const results: SyncResult[] = [];
  for (const t of targets) results.push(await runSync(t.id, { db }));
  return Response.json({ results });
}
