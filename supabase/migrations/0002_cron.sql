-- Schedules: Supabase pg_cron + pg_net call the Next.js cron routes.
-- Before applying: store the two secrets in Vault (Dashboard → Project Settings → Vault, or SQL below):
--   select vault.create_secret('https://social.vadim.bio', 'app_base_url');
--   select vault.create_secret('<CRON_SECRET value from Vercel env>', 'cron_secret');
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.call_cron_route(path text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  base_url text;
  secret text;
  request_id bigint;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if base_url is null or secret is null then
    raise exception 'Vault secrets app_base_url / cron_secret are missing';
  end if;
  select net.http_post(
    url := base_url || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function public.call_cron_route(text) from public, anon, authenticated;

-- Times are UTC. Chisinau = UTC+2/+3, so 21,03,09,15 UTC ≈ 00,06,12,18 local (±1h across DST).
select cron.unschedule(jobname) from cron.job where jobname in ('sb-sync-6h','sb-benchmarks-daily','sb-benchmarks-monthly','sb-token-refresh-daily','sb-goal-comments-daily');
select cron.schedule('sb-sync-6h',            '0 21,3,9,15 * * *', $$select public.call_cron_route('/api/cron/sync')$$);
select cron.schedule('sb-benchmarks-daily',   '15 1 * * *',        $$select public.call_cron_route('/api/cron/benchmarks')$$);
select cron.schedule('sb-benchmarks-monthly', '15 0 1 * *',        $$select public.call_cron_route('/api/cron/benchmarks')$$);
select cron.schedule('sb-token-refresh-daily','30 1 * * *',        $$select public.call_cron_route('/api/cron/token-refresh')$$);
select cron.schedule('sb-goal-comments-daily','0 5 * * *',         $$select public.call_cron_route('/api/cron/goal-comments')$$);
