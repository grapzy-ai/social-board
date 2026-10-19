import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { refreshIfNeeded } from "@/lib/sync/tokens";
import { isCronAuthorized, unauthorized } from "@/lib/api/cron-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return unauthorized();
  const db = getDb();
  const rows = await db.select().from(accounts).where(inArray(accounts.platform, ["threads", "instagram"]));
  const results: Record<string, string> = {};
  for (const a of rows) results[`${a.platform}:${a.handle}`] = await refreshIfNeeded(db, a);
  return Response.json({ results });
}
