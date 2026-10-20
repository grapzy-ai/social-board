import { getDb } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { recomputeBenchmarks } from "@/lib/metrics/recompute-benchmarks";
import { isCronAuthorized, unauthorized } from "@/lib/api/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return unauthorized();
  const db = getDb();
  const ids = (await db.select({ id: accounts.id }).from(accounts)).map((a) => a.id);
  const written = await recomputeBenchmarks(db, ids);
  return Response.json({ written });
}
