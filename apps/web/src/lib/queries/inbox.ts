import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { AnyDb } from "@/lib/db/types";
import { inboxItems, type InboxItem, type InboxStatus } from "@/lib/db/schema";

export type InboxFilter = { language?: "ru" | "en"; status?: InboxStatus | "open" };

const OPEN: InboxStatus[] = ["new", "sorted"];

export async function listInbox(db: AnyDb, f: InboxFilter = {}): Promise<InboxItem[]> {
  const conds = [];
  // unsorted items have no language yet; they must not vanish inside a language segment
  if (f.language) conds.push(or(eq(inboxItems.language, f.language), isNull(inboxItems.language))!);
  if (f.status === "open") conds.push(inArray(inboxItems.status, OPEN));
  else if (f.status) conds.push(eq(inboxItems.status, f.status));
  return db
    .select()
    .from(inboxItems)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(inboxItems.createdAt))
    .limit(200);
}

export async function getInboxItem(db: AnyDb, id: string): Promise<InboxItem | null> {
  const rows = await db.select().from(inboxItems).where(eq(inboxItems.id, id)).limit(1);
  return rows[0] ?? null;
}
