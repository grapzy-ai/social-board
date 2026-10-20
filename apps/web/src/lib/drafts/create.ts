import { eq } from "drizzle-orm";
import type { AnyDb } from "@/lib/db/types";
import { drafts, inboxItems, type Draft } from "@/lib/db/schema";
import type { GeneratedPackage } from "@/lib/claude/package";

export interface CreateCtx {
  inboxItemId: string | null;
  language: "ru" | "en";
  telegramAccountId: string | null;
}

/** One package → 14 draft rows (4 reel, 5 threads, 1 carousel, 3 story, 1 tg), all `draft`; the inbox item becomes `used`. */
export async function createDraftsFromPackage(db: AnyDb, pkg: GeneratedPackage, ctx: CreateCtx): Promise<Draft[]> {
  const common = { inboxItemId: ctx.inboxItemId, language: ctx.language, status: "draft" as const };
  const values = [
    ...pkg.reels.map((r) => ({ ...common, type: "reel" as const, title: r.title, body: { script: r.script, hooks: r.hooks, cover: r.cover, angle: r.angle, hookMechanic: r.hookMechanic, funnel: r.funnel } })),
    ...pkg.threads.map((t, i) => ({ ...common, type: "threads" as const, title: `Threads ${i + 1}`, body: { text: t } })),
    { ...common, type: "carousel" as const, title: pkg.carousel.title, body: { slides: pkg.carousel.slides, caption: pkg.carousel.caption } },
    ...pkg.stories.map((s, i) => ({ ...common, type: "story" as const, title: `Сторис ${i + 1}`, body: { text: s } })),
    { ...common, type: "tg" as const, title: pkg.tg.title, body: { text: pkg.tg.text }, accountId: ctx.telegramAccountId },
  ];
  return db.transaction(async (tx) => {
    const rows = await tx.insert(drafts).values(values).returning();
    if (ctx.inboxItemId) await tx.update(inboxItems).set({ status: "used", updatedAt: new Date() }).where(eq(inboxItems.id, ctx.inboxItemId));
    return rows;
  });
}
