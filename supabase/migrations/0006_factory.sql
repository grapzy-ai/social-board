-- Content factory: inbox (bot/drive/manual intake) and drafts (generated, approved, published).

CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"tg_chat_id" text,
	"tg_message_id" bigint,
	"tg_file_id" text,
	"text" text,
	"transcript" text,
	"media_ref" text,
	"tags" jsonb,
	"language" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "inbox_tg_msg_uq" ON "inbox_items" ("tg_chat_id", "tg_message_id");
CREATE INDEX "inbox_status_idx" ON "inbox_items" ("status");

CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_item_id" uuid REFERENCES "inbox_items"("id") ON DELETE SET NULL,
	"pillar_id" uuid REFERENCES "pillars"("id") ON DELETE SET NULL,
	"account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL,
	"type" text NOT NULL,
	"language" text DEFAULT 'ru' NOT NULL,
	"title" text NOT NULL,
	"body" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"assets" jsonb,
	"scheduled_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_url" text,
	"published_post_id" uuid REFERENCES "posts"("id") ON DELETE SET NULL,
	"publish_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "drafts_status_idx" ON "drafts" ("status");
CREATE INDEX "drafts_inbox_idx" ON "drafts" ("inbox_item_id");

-- Row Level Security (no policies: PostgREST access only via service_role, which has default privileges from 0004)
ALTER TABLE "inbox_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;
