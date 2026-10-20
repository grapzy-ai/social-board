"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { addAccount } from "@/lib/sync/tokens";
import { runSync } from "@/lib/sync/run";
import { syncSegment } from "@/lib/sync/segment";
import { recordManualMetrics } from "@/lib/metrics/manual";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { goals, PLATFORMS } from "@/lib/db/schema";
import { requireAllowedUser } from "@/lib/auth/require";

const AddSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().trim().min(1),
  externalUserId: z.string().trim().optional(),
  language: z.enum(["ru", "en"]),
  role: z.enum(["focus", "mirror", "lifestyle"]),
  token: z.string().trim().optional(),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(60),
});

export async function addAccountAction(formData: FormData) {
  await requireAllowedUser();
  const input = AddSchema.parse(Object.fromEntries(formData));
  await addAccount(getDb(), {
    platform: input.platform,
    handle: input.handle,
    externalUserId: input.externalUserId || null,
    language: input.language,
    role: input.role,
    token: input.token || null,
    expiresAt: input.token ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
  });
  revalidatePath("/settings/accounts");
}

const GoalSchema = z.object({
  accountId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  target: z.coerce.number().int().positive(),
});

export async function setGoalAction(formData: FormData) {
  await requireAllowedUser();
  const input = GoalSchema.parse(Object.fromEntries(formData));
  const db = getDb();
  await db
    .insert(goals)
    .values({ accountId: input.accountId, month: `${input.month}-01`, metric: "followers", target: input.target })
    .onConflictDoUpdate({ target: [goals.accountId, goals.month, goals.metric], set: { target: input.target, updatedAt: new Date() } });
  revalidatePath("/settings/accounts");
  revalidatePath("/");
}

export async function syncNowAction(formData: FormData) {
  await requireAllowedUser();
  const accountId = z.string().uuid().parse(formData.get("accountId"));
  await runSync(accountId, { db: getDb() });
  revalidatePath("/settings/accounts");
  revalidatePath("/");
  revalidatePath("/posts");
}

export async function syncSegmentAction(formData: FormData) {
  await requireAllowedUser();
  const segment = resolveSegment((await cookies()).get(SEGMENT_COOKIE)?.value);
  const report = await syncSegment(getDb(), segmentLanguage(segment));
  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/settings/accounts");
  const ok = report.results.filter((r) => r.status !== "error").length;
  const back = String(formData.get("back") ?? "/");
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  const sep = safeBack.includes("?") ? "&" : "?";
  redirect(`${safeBack}${sep}refreshed=${ok}/${report.results.length}`);
}

const ManualSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  followers: z.union([z.literal(""), z.coerce.number().int().min(0)]).transform((v) => (v === "" ? null : v)),
  views: z.union([z.literal(""), z.coerce.number().int().min(0)]).transform((v) => (v === "" ? null : v)),
  note: z.string().trim().max(200).optional(),
});

export async function manualMetricsAction(formData: FormData) {
  await requireAllowedUser();
  const input = ManualSchema.parse(Object.fromEntries(formData));
  await recordManualMetrics(getDb(), { accountId: input.accountId, date: input.date, followers: input.followers, views: input.views, note: input.note || null });
  revalidatePath("/");
  revalidatePath("/settings/accounts");
}

/** Points the bot's webhook at this deployment. The secret token is derived from CRON_SECRET (lib/telegram/webhook). */
export async function connectWebhookAction() {
  await requireAllowedUser();
  const { setWebhook } = await import("@/lib/telegram/admin");
  const { webhookSecret } = await import("@/lib/telegram/webhook");
  if (!process.env.CRON_SECRET) redirect("/settings/accounts?bot=" + encodeURIComponent("CRON_SECRET не задан — вебхук без секрета не подключаем"));
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const r = await setWebhook(`${base}/api/telegram/webhook`, webhookSecret());
  redirect(`/settings/accounts?bot=${r.ok ? "ok" : encodeURIComponent(r.error ?? "error")}`);
}

/** Checks that the bot is an admin with posting rights in the channel of a telegram account. */
export async function checkChannelAction(formData: FormData) {
  await requireAllowedUser();
  const accountId = z.string().uuid().parse(formData.get("accountId"));
  const { botId, getChatMember } = await import("@/lib/telegram/admin");
  const { accounts: accTable } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const [acc] = await getDb().select({ handle: accTable.handle }).from(accTable).where(eq(accTable.id, accountId)).limit(1);
  const id = botId();
  if (!acc || id === null) redirect("/settings/accounts?channel=" + encodeURIComponent("нет аккаунта или токена бота"));
  const m = await getChatMember(`@${acc!.handle}`, id!);
  const msg = !m ? "канал не найден или бот не в канале" : m.canPost ? `ок — бот админ @${acc!.handle} с правом публикации` : `бот в канале как «${m.status}», права публиковать нет`;
  redirect("/settings/accounts?channel=" + encodeURIComponent(msg));
}
