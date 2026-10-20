import { timingSafeEqual } from "node:crypto";

/** True when the request carries `Authorization: Bearer <CRON_SECRET>`. */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
