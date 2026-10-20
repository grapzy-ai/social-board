-- PostgREST honours `on_conflict=` only for columns backed by a UNIQUE CONSTRAINT (pg_constraint);
-- Drizzle's uniqueIndex() creates a bare unique index, so the worker's upserts fell back to the PK
-- and the second run hit "duplicate key value violates unique constraint posts_account_external_uq".
-- Promote the existing unique indexes to constraints (no data change, no new index).
ALTER TABLE posts                  ADD CONSTRAINT posts_account_external_key   UNIQUE USING INDEX posts_account_external_uq;
ALTER TABLE post_metrics_snapshots ADD CONSTRAINT snapshots_post_day_key       UNIQUE USING INDEX snapshots_post_day_uq;
ALTER TABLE account_metrics_daily  ADD CONSTRAINT account_daily_key            UNIQUE USING INDEX account_daily_uq;
ALTER TABLE accounts               ADD CONSTRAINT accounts_platform_handle_key UNIQUE USING INDEX accounts_platform_handle_uq;
ALTER TABLE benchmarks             ADD CONSTRAINT benchmarks_account_format_day_key UNIQUE USING INDEX benchmarks_account_format_day_uq;
ALTER TABLE goals                  ADD CONSTRAINT goals_account_month_metric_key UNIQUE USING INDEX goals_account_month_metric_uq;
ALTER TABLE manual_metrics         ADD CONSTRAINT manual_metrics_account_date_key UNIQUE USING INDEX manual_metrics_account_date_uq;
NOTIFY pgrst, 'reload schema';
