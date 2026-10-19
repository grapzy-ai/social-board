import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  boolean,
  date,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const PLATFORMS = ["threads", "instagram", "telegram", "tiktok", "vk", "youtube", "linkedin"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const POST_FORMATS = ["reel", "carousel", "image", "thread", "tg_post", "short", "tiktok"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export const LABELS = ["hit", "miss", "odd"] as const;
export type Label = (typeof LABELS)[number] | null;

export const ACCOUNT_ROLES = ["focus", "mirror", "lifestyle"] as const;
export const LANGUAGES = ["ru", "en"] as const;
export const ACCOUNT_STATUSES = ["active", "paused", "token_invalid"] as const;

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    handle: text("handle").notNull(),
    externalUserId: text("external_user_id"),
    language: text("language", { enum: LANGUAGES }).notNull().default("ru"),
    role: text("role", { enum: ACCOUNT_ROLES }).notNull().default("focus"),
    tokenEnc: text("token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    status: text("status", { enum: ACCOUNT_STATUSES }).notNull().default("active"),
    lastOkSyncAt: timestamp("last_ok_sync_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("accounts_platform_handle_uq").on(t.platform, t.handle)],
);

export const pillars = pgTable("pillars", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    format: text("format", { enum: POST_FORMATS }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    text: text("text"),
    mediaUrl: text("media_url"),
    permalink: text("permalink"),
    pillarId: uuid("pillar_id").references(() => pillars.id, { onDelete: "set null" }),
    rubric: text("rubric"),
    series: text("series"),
    language: text("language", { enum: LANGUAGES }).notNull().default("ru"),
    label: text("label", { enum: LABELS }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("posts_account_external_uq").on(t.accountId, t.externalId),
    index("posts_account_published_idx").on(t.accountId, t.publishedAt),
  ],
);

export const postMetricsSnapshots = pgTable(
  "post_metrics_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    views: integer("views"),
    reach: integer("reach"),
    likes: integer("likes"),
    comments: integer("comments"),
    saves: integer("saves"),
    reposts: integer("reposts"),
    shares: integer("shares"),
    clicks: integer("clicks"),
    avgWatchTimeSec: real("avg_watch_time_sec"),
  },
  (t) => [uniqueIndex("snapshots_post_day_uq").on(t.postId, t.dayIndex)],
);

export const accountMetricsDaily = pgTable(
  "account_metrics_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    followers: integer("followers"),
    profileViews: integer("profile_views"),
    reach: integer("reach"),
    newFollowers: integer("new_followers"),
    extra: jsonb("extra"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("account_daily_uq").on(t.accountId, t.date)],
);

export const benchmarks = pgTable(
  "benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    format: text("format", { enum: POST_FORMATS }).notNull(),
    periodDays: integer("period_days").notNull().default(90),
    medianViews: real("median_views"),
    medianComments: real("median_comments"),
    medianSaves: real("median_saves"),
    sampleSize: integer("sample_size").notNull().default(0),
    provisional: boolean("provisional").notNull().default(false),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    computedOn: date("computed_on").notNull().default(sql`CURRENT_DATE`),
  },
  (t) => [uniqueIndex("benchmarks_account_format_day_uq").on(t.accountId, t.format, t.computedOn)],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    month: date("month").notNull(), // first day of month
    metric: text("metric").notNull().default("followers"),
    target: integer("target").notNull(),
    comment: text("comment"),
    commentAt: timestamp("comment_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("goals_account_month_metric_uq").on(t.accountId, t.month, t.metric)],
);

export const SIGNAL_TYPES = [
  "token_expired",
  "token_expiring",
  "sync_failing",
  "post_x3_24h",
  "repeated_question",
  "week_drop",
  "day11_due",
  "goal_behind",
] as const;

export const signals = pgTable("signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  type: text("type", { enum: SIGNAL_TYPES }).notNull(),
  payload: jsonb("payload"),
  status: text("status", { enum: ["new", "sent", "dismissed"] }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status", { enum: ["ok", "partial", "error"] }).notNull(),
  postsUpserted: integer("posts_upserted").notNull().default(0),
  snapshotsWritten: integer("snapshots_written").notNull().default(0),
  error: text("error"),
});

export const manualMetrics = pgTable(
  "manual_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    followers: integer("followers"),
    views: integer("views"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("manual_metrics_account_date_uq").on(t.accountId, t.date)],
);

export type Account = typeof accounts.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostMetricsSnapshot = typeof postMetricsSnapshots.$inferSelect;
