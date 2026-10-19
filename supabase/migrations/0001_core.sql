CREATE TABLE "account_metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"followers" integer,
	"profile_views" integer,
	"reach" integer,
	"new_followers" integer,
	"extra" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"external_user_id" text,
	"language" text DEFAULT 'ru' NOT NULL,
	"role" text DEFAULT 'focus' NOT NULL,
	"token_enc" text,
	"token_expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"last_ok_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"format" text NOT NULL,
	"period_days" integer DEFAULT 90 NOT NULL,
	"median_views" real,
	"median_comments" real,
	"median_saves" real,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"provisional" boolean DEFAULT false NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"computed_on" date DEFAULT CURRENT_DATE NOT NULL
);

CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"month" date NOT NULL,
	"metric" text DEFAULT 'followers' NOT NULL,
	"target" integer NOT NULL,
	"comment" text,
	"comment_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "manual_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"followers" integer,
	"views" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "post_metrics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views" integer,
	"reach" integer,
	"likes" integer,
	"comments" integer,
	"saves" integer,
	"reposts" integer,
	"shares" integer,
	"clicks" integer,
	"avg_watch_time_sec" real
);

CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"format" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"text" text,
	"media_url" text,
	"permalink" text,
	"pillar_id" uuid,
	"rubric" text,
	"series" text,
	"language" text DEFAULT 'ru' NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"posts_upserted" integer DEFAULT 0 NOT NULL,
	"snapshots_written" integer DEFAULT 0 NOT NULL,
	"error" text
);

ALTER TABLE "account_metrics_daily" ADD CONSTRAINT "account_metrics_daily_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "benchmarks" ADD CONSTRAINT "benchmarks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "manual_metrics" ADD CONSTRAINT "manual_metrics_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "post_metrics_snapshots" ADD CONSTRAINT "post_metrics_snapshots_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT "posts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT "posts_pillar_id_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "signals" ADD CONSTRAINT "signals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "account_daily_uq" ON "account_metrics_daily" USING btree ("account_id","date");
CREATE UNIQUE INDEX "accounts_platform_handle_uq" ON "accounts" USING btree ("platform","handle");
CREATE UNIQUE INDEX "benchmarks_account_format_day_uq" ON "benchmarks" USING btree ("account_id","format","computed_on");
CREATE UNIQUE INDEX "goals_account_month_metric_uq" ON "goals" USING btree ("account_id","month","metric");
CREATE UNIQUE INDEX "manual_metrics_account_date_uq" ON "manual_metrics" USING btree ("account_id","date");
CREATE UNIQUE INDEX "snapshots_post_day_uq" ON "post_metrics_snapshots" USING btree ("post_id","day_index");
CREATE UNIQUE INDEX "posts_account_external_uq" ON "posts" USING btree ("account_id","external_id");
CREATE INDEX "posts_account_published_idx" ON "posts" USING btree ("account_id","published_at");
-- Row Level Security: authenticated users read everything; writes only via service_role (bypasses RLS).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','pillars','posts','post_metrics_snapshots','account_metrics_daily','benchmarks','goals','signals','sync_runs','manual_metrics'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t || '_read_authenticated', t);
  END LOOP;
END $$;
