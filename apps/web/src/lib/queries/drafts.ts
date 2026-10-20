import { and, desc, eq } from "drizzle-orm";
import type { AnyDb } from "@/lib/db/types";
import { drafts, type Draft, type DraftStatus, type DraftType } from "@/lib/db/schema";

export type DraftFilter = { language?: "ru" | "en"; status?: DraftStatus; type?: DraftType; inboxItemId?: string };

export async function listDrafts(db: AnyDb, f: DraftFilter = {}): Promise<Draft[]> {
  const conds = [];
  if (f.language) conds.push(eq(drafts.language, f.language));
  if (f.status) conds.push(eq(drafts.status, f.status));
  if (f.type) conds.push(eq(drafts.type, f.type));
  if (f.inboxItemId) conds.push(eq(drafts.inboxItemId, f.inboxItemId));
  return db
    .select()
    .from(drafts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(drafts.createdAt))
    .limit(300);
}

export async function getDraft(db: AnyDb, id: string): Promise<Draft | null> {
  const rows = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  return rows[0] ?? null;
}
