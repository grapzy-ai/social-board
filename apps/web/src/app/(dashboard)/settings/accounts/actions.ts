"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { addAccount } from "@/lib/sync/tokens";
import { runSync } from "@/lib/sync/run";
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
