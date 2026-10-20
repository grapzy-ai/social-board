"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { inboxItems } from "@/lib/db/schema";
import { requireAllowedUser } from "@/lib/auth/require";
import { sortInboxItem } from "@/lib/claude/sorter";

const URL_RE = /https?:\/\/\S+/;

/** Desktop intake: a textarea in /inbox. Pure links become `link`, everything else `text`. */
export async function addManualItemAction(formData: FormData) {
  await requireAllowedUser();
  const text = z.string().trim().min(1).max(10_000).parse(formData.get("text"));
  const url = text.match(URL_RE)?.[0] ?? null;
  const kind = url && text === url ? "link" : "text";
  const db = getDb();
  const [item] = await db.insert(inboxItems).values({ source: "manual", kind, text, mediaRef: url }).returning({ id: inboxItems.id });
  const tags = await sortInboxItem({ text, kind });
  await db.update(inboxItems).set({ tags, language: tags.language, status: "sorted", updatedAt: new Date() }).where(eq(inboxItems.id, item.id));
  revalidatePath("/inbox");
  redirect(`/inbox/${item.id}`);
}

export async function archiveItemAction(formData: FormData) {
  await requireAllowedUser();
  const id = z.string().uuid().parse(formData.get("id"));
  await getDb().update(inboxItems).set({ status: "archived", updatedAt: new Date() }).where(eq(inboxItems.id, id));
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
}

export async function reopenItemAction(formData: FormData) {
  await requireAllowedUser();
  const id = z.string().uuid().parse(formData.get("id"));
  await getDb().update(inboxItems).set({ status: "sorted", updatedAt: new Date() }).where(eq(inboxItems.id, id));
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
}

export async function resortItemAction(formData: FormData) {
  await requireAllowedUser();
  const id = z.string().uuid().parse(formData.get("id"));
  const db = getDb();
  const [item] = await db.select().from(inboxItems).where(eq(inboxItems.id, id)).limit(1);
  if (!item) return;
  const text = (item.transcript ?? item.text ?? "").trim();
  if (!text) return;
  const tags = await sortInboxItem({ text, kind: item.kind });
  await db.update(inboxItems).set({ tags, language: tags.language, status: item.status === "new" ? "sorted" : item.status, updatedAt: new Date() }).where(eq(inboxItems.id, id));
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
}
