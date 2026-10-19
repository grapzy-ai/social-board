import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { accounts, posts, postMetricsSnapshots, type Label, type Platform, type PostFormat } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { latestBenchmarks } from "@/lib/metrics/recompute-benchmarks";
import { multiplier, snapshotForDay } from "@/lib/metrics/multiplier";

export interface PostFilter {
  accountId?: string;
  format?: PostFormat;
  language?: "ru" | "en";
  label?: Exclude<Label, null>;
  from?: Date;
  to?: Date;
}

export type PostSort = "date" | "multiplier";

export interface PostRow {
  id: string;
  externalId: string;
  platform: Platform;
  handle: string;
  language: "ru" | "en";
  format: PostFormat;
  publishedAt: Date;
  text: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  day11Views: number | null;
  day11Index: number | null;
  benchmark: number | null;
  benchmarkProvisional: boolean;
  multiplier: number | null;
  label: Label;
  comments: number | null;
  saves: number | null;
  latestViews: number | null;
}

export async function listPosts(db: AnyDb, filter: PostFilter, sort: PostSort): Promise<PostRow[]> {
  const conds: SQL[] = [];
  if (filter.accountId) conds.push(eq(posts.accountId, filter.accountId));
  if (filter.format) conds.push(eq(posts.format, filter.format));
  if (filter.language) conds.push(eq(posts.language, filter.language));
  if (filter.label) conds.push(eq(posts.label, filter.label));
  if (filter.from) conds.push(gte(posts.publishedAt, filter.from));
  if (filter.to) conds.push(lte(posts.publishedAt, filter.to));

  const base = await db
    .select({ post: posts, platform: accounts.platform, handle: accounts.handle })
    .from(posts)
    .innerJoin(accounts, eq(accounts.id, posts.accountId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(posts.publishedAt));
  if (base.length === 0) return [];

  const ids = base.map((b) => b.post.id);
  const snaps = await db.select().from(postMetricsSnapshots).where(inArray(postMetricsSnapshots.postId, ids));
  const byPost = new Map<string, typeof snaps>();
  for (const s of snaps) byPost.set(s.postId, [...(byPost.get(s.postId) ?? []), s]);
  const bench = await latestBenchmarks(db);

  const rows: PostRow[] = base.map(({ post, platform, handle }) => {
    const ps = byPost.get(post.id) ?? [];
    const d11 = snapshotForDay(ps);
    const latest = ps.reduce<(typeof ps)[number] | null>((a, b) => (a === null || b.dayIndex > a.dayIndex ? b : a), null);
    const b = bench.get(`${post.accountId}:${post.format}`);
    const benchmark = b?.medianViews ?? null;
    return {
      id: post.id,
      externalId: post.externalId,
      platform,
      handle,
      language: post.language,
      format: post.format,
      publishedAt: post.publishedAt,
      text: post.text,
      permalink: post.permalink,
      mediaUrl: post.mediaUrl,
      day11Views: d11?.views ?? null,
      day11Index: d11?.dayIndex ?? null,
      benchmark,
      benchmarkProvisional: b?.provisional ?? false,
      multiplier: multiplier(d11?.views ?? null, benchmark),
      label: post.label,
      comments: latest?.comments ?? null,
      saves: latest?.saves ?? null,
      latestViews: latest?.views ?? null,
    };
  });

  if (sort === "multiplier") {
    rows.sort((a, b) => {
      if (a.multiplier === null && b.multiplier === null) return b.publishedAt.getTime() - a.publishedAt.getTime();
      if (a.multiplier === null) return 1;
      if (b.multiplier === null) return -1;
      return b.multiplier - a.multiplier;
    });
  }
  return rows;
}

export async function getPost(db: AnyDb, id: string) {
  const [row] = await listPosts(db, {}, "date").then((all) => all.filter((p) => p.id === id));
  if (!row) return null;
  const snapshots = await db.select().from(postMetricsSnapshots).where(eq(postMetricsSnapshots.postId, id)).orderBy(postMetricsSnapshots.dayIndex);
  return { ...row, snapshots };
}

export async function setLabel(db: AnyDb, postId: string, label: Label): Promise<void> {
  await db.update(posts).set({ label, updatedAt: new Date() }).where(eq(posts.id, postId));
}
