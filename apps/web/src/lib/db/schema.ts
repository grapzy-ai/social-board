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
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const PLATFORMS = ["threads", "instagram", "telegram", "tiktok", "vk", "youtube", "linkedin", "x"] as const;
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

// ---------------------------------------------------------------------------
// Content factory (0006): inbox intake + drafts

export const INBOX_SOURCES = ["bot", "drive", "manual"] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];
export const INBOX_KINDS = ["voice", "text", "link", "photo", "video", "document", "forward"] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];
export const INBOX_STATUSES = ["new", "sorted", "used", "archived"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const PILLAR_KEYS = ["influence", "build", "life", "market"] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];
export const TARGET_KEYS = ["reel", "threads", "carousel", "story", "tg", "tiktok_life"] as const;
export type TargetKey = (typeof TARGET_KEYS)[number];

export type SortTags = {
  pillar: PillarKey | null;
  format: TargetKey | null;
  kind: "raw" | "idea" | "reference" | "trend";
  language: "ru" | "en";
  summary: string;
  hooks: string[];
};

export const DRAFT_TYPES = ["reel", "threads", "carousel", "story", "tg"] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];
export const DRAFT_STATUSES = ["idea", "draft", "ready", "approved", "scheduled", "published", "rejected"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export type DraftBody = { text: string } | { script: string; hooks: string[]; cover: string } | { slides: string[]; caption: string };

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: INBOX_SOURCES }).notNull(),
    kind: text("kind", { enum: INBOX_KINDS }).notNull(),
    tgChatId: text("tg_chat_id"),
    tgMessageId: bigint("tg_message_id", { mode: "number" }),
    tgFileId: text("tg_file_id"),
    text: text("text"),
    transcript: text("transcript"),
    mediaRef: text("media_ref"),
    tags: jsonb("tags").$type<SortTags>(),
    language: text("language", { enum: LANGUAGES }),
    status: text("status", { enum: INBOX_STATUSES }).notNull().default("new"),
    ...timestamps,
  },
  (t) => [uniqueIndex("inbox_tg_msg_uq").on(t.tgChatId, t.tgMessageId), index("inbox_status_idx").on(t.status)],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, { onDelete: "set null" }),
    pillarId: uuid("pillar_id").references(() => pillars.id, { onDelete: "set null" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    type: text("type", { enum: DRAFT_TYPES }).notNull(),
    language: text("language", { enum: LANGUAGES }).notNull().default("ru"),
    title: text("title").notNull(),
    body: jsonb("body").$type<DraftBody>().notNull(),
    status: text("status", { enum: DRAFT_STATUSES }).notNull().default("draft"),
    assets: jsonb("assets"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedUrl: text("published_url"),
    publishedPostId: uuid("published_post_id").references(() => posts.id, { onDelete: "set null" }),
    publishError: text("publish_error"),
    ...timestamps,
  },
  (t) => [index("drafts_status_idx").on(t.status), index("drafts_inbox_idx").on(t.inboxItemId)],
);

export type InboxItem = typeof inboxItems.$inferSelect;
export type Draft = typeof drafts.$inferSelect;

export type Account = typeof accounts.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostMetricsSnapshot = typeof postMetricsSnapshots.$inferSelect;
