import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accounts, accountMetricsDaily, goals, signals } from "@/lib/db/schema";
import { isCronAuthorized, unauthorized } from "@/lib/api/cron-auth";
import { generateGoalComment } from "@/lib/claude/goal-comment";
import { chisinauDate } from "@/lib/time";
import { notifyAll } from "@/lib/telegram/notify";
import { PLATFORM_LABEL } from "@/lib/ui/platform";

export const runtime = "nodejs";
export const maxDuration = 120;

const SIGNAL_TEXT: Record<string, string> = {
  token_expired: "токен истёк — нужна повторная авторизация",
  token_expiring: "токен скоро истечёт, автопродление не удалось",
  sync_failing: "сборщик падает несколько раз подряд",
};

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return unauthorized();
  const db = getDb();
  const now = new Date();
  const today = chisinauDate(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysLeft = daysInMonth - Number(today.slice(8, 10));

  const goalRows = await db.select().from(goals).where(and(eq(goals.month, monthStart), eq(goals.metric, "followers")));
  const accs = goalRows.length ? await db.select().from(accounts).where(inArray(accounts.id, goalRows.map((g) => g.accountId))) : [];
  const since = new Date(now.getTime() - 8 * 86_400_000);
  const daily = accs.length
    ? await db.select().from(accountMetricsDaily).where(and(inArray(accountMetricsDaily.accountId, accs.map((a) => a.id)), gte(accountMetricsDaily.date, chisinauDate(since)))).orderBy(accountMetricsDaily.date)
    : [];

  let updated = 0;
  for (const g of goalRows) {
    const a = accs.find((x) => x.id === g.accountId);
    if (!a) continue;
    const series = daily.filter((d) => d.accountId === a.id && d.followers !== null);
    if (series.length === 0) continue;
    const followers = series[series.length - 1].followers!;
    const prev = series.length >= 2 ? series[series.length - 2].followers! : null;
    const deltaYesterday = prev === null ? null : followers - prev;
    const first = series[0].followers!;
    const spanDays = Math.max(1, series.length - 1);
    const avgDaily7 = series.length >= 2 ? Math.round(((followers - first) / spanDays) * 10) / 10 : null;
    const comment = await generateGoalComment({ platform: PLATFORM_LABEL[a.platform], handle: a.handle, followers, target: g.target, daysLeft, deltaYesterday, avgDaily7 });
    if (comment) {
      await db.update(goals).set({ comment, commentAt: now, updatedAt: now }).where(eq(goals.id, g.id));
      updated += 1;
    }
  }

  // digest of new signals (last 24h) → bot
  const fresh = await db.select().from(signals).where(and(eq(signals.status, "new"), gte(signals.createdAt, new Date(now.getTime() - 86_400_000))));
  if (fresh.length) {
    const lines = fresh.map((s) => `• ${SIGNAL_TEXT[s.type] ?? s.type}${s.accountId ? ` (${accs.find((a) => a.id === s.accountId)?.handle ?? s.accountId.slice(0, 8)})` : ""}`);
    await notifyAll(`Social Board — сигналы за сутки:\n${lines.join("\n")}`);
    await db.update(signals).set({ status: "sent" }).where(inArray(signals.id, fresh.map((s) => s.id)));
  }
  return Response.json({ updated, signalsSent: fresh.length });
}
