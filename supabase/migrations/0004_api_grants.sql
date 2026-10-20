-- Tables created by 0001 never received Supabase's standard API grants (only REFERENCES/TRIGGER/
-- TRUNCATE were present), so PostgREST answered 403 for every worker request regardless of key.
-- Only the server-side role needs table access; anon/authenticated get none (supersedes 0003).
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_read_authenticated', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
