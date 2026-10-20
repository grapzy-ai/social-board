"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { accounts, drafts, DRAFT_STATUSES, DRAFT_TYPES, type DraftStatus, type DraftType } from "@/lib/db/schema";
import { requireAllowedUser } from "@/lib/auth/require";
import { generatePackage } from "@/lib/claude/package";
import { createDraftsFromPackage } from "@/lib/drafts/create";
import { bodyFromForm, canTransition } from "@/lib/drafts/status";
import { getInboxItem } from "@/lib/queries/inbox";
import { notifyAll } from "@/lib/telegram/notify";
import { sendApprovalCard } from "@/lib/drafts/approval";

const base = () => (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");

const GenSchema = z.object({
  inboxId: z.string().uuid().optional().or(z.literal("")),
  sourceText: z.string().optional(),
  language: z.enum(["ru", "en"]).default("ru"),
});

/** Source (inbox item or free text) → Claude → 14 drafts. Errors come back on the form, never as a half-package. */
export async function generatePackageAction(formData: FormData) {
  await requireAllowedUser();
  const input = GenSchema.parse(Object.fromEntries(formData));
  const db = getDb();
  const inboxId = input.inboxId || null;
  let sourceText = (input.sourceText ?? "").trim();
  let summary: string | undefined;
  let pillar: "influence" | "build" | "life" | "market" | null = null;
  if (inboxId) {
    const item = await getInboxItem(db, inboxId);
    if (!item) redirect(`/drafts/new?error=${encodeURIComponent("входящее не найдено")}`);
    const own = [item.transcript ?? item.text ?? "", item.mediaRef ? `Ссылка/материал: ${item.mediaRef}` : ""].filter(Boolean).join("\n");
    sourceText = sourceText || own;
    summary = item.tags?.summary;
    pillar = item.tags?.pillar ?? null;
  }
  if (sourceText.length < 20) redirect(`/drafts/new?${inboxId ? `inbox=${inboxId}&` : ""}error=${encodeURIComponent("исходник слишком короткий")}`);

  const res = await generatePackage({ sourceText, summary, pillar, language: input.language });
  if (!res.ok) redirect(`/drafts/new?${inboxId ? `inbox=${inboxId}&` : ""}error=${encodeURIComponent(res.error)}`);

  const [tg] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.platform, "telegram"), eq(accounts.language, input.language)))
    .limit(1);
  const rows = await createDraftsFromPackage(db, res.pkg, { inboxItemId: inboxId, language: input.language, telegramAccountId: tg?.id ?? null });
  await notifyAll(`Пакет готов: ${rows.length} черновиков → ${base()}/drafts${inboxId ? `?inbox=${inboxId}` : ""}`);
  revalidatePath("/drafts");
  revalidatePath("/inbox");
  redirect(`/drafts${inboxId ? `?inbox=${inboxId}` : ""}`);
}

const SaveSchema = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200), type: z.enum(DRAFT_TYPES) });

export async function saveDraftAction(formData: FormData) {
  await requireAllowedUser();
  const { id, title, type } = SaveSchema.parse({ id: formData.get("id"), title: formData.get("title"), type: formData.get("type") });
  await getDb().update(drafts).set({ title, body: bodyFromForm(type as DraftType, formData), updatedAt: new Date() }).where(eq(drafts.id, id));
  revalidatePath(`/drafts/${id}`);
  revalidatePath("/drafts");
}

const StatusSchema = z.object({ id: z.string().uuid(), status: z.enum(DRAFT_STATUSES) });

/** Guarded transition through the editorial state machine; `ready` sends the approval card to the bot. */
export async function setDraftStatusAction(formData: FormData) {
  await requireAllowedUser();
  const { id, status } = StatusSchema.parse({ id: formData.get("id"), status: formData.get("status") });
  const db = getDb();
  const [d] = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  if (!d || !canTransition(d.status, status as DraftStatus)) return;
  const patch: Partial<typeof drafts.$inferInsert> = { status: status as DraftStatus, updatedAt: new Date() };
  if (status === "approved") patch.approvedAt = new Date();
  await db.update(drafts).set(patch).where(and(eq(drafts.id, id), eq(drafts.status, d.status)));
  if (status === "ready") await sendApprovalCard({ ...d, status: "ready" });
  revalidatePath(`/drafts/${id}`);
  revalidatePath("/drafts");
}

/** Dashboard «Опубликовать в Telegram»: delegates to the same guarded publisher the bot button uses. */
export async function publishDraftAction(formData: FormData) {
  await requireAllowedUser();
  const id = z.string().uuid().parse(formData.get("id"));
  const { makeTelegramPublisher } = await import("@/lib/publish/telegram");
  const r = await makeTelegramPublisher()(getDb(), id);
  revalidatePath(`/drafts/${id}`);
  revalidatePath("/drafts");
  if (!r.ok) redirect(`/drafts/${id}?error=${encodeURIComponent(r.error)}`);
}
