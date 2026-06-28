-- Fundação de backup robusto (paridade GEOCON, adaptado ao GEOLAB).
-- Aditivo e idempotente. RLS admin-only (espelha cron_heartbeat/ef_invocation_log: has_role('admin')).

create table if not exists public.backup_log (
  id              uuid primary key default gen_random_uuid(),
  backup_type     text not null,                       -- 'database' | 'storage' | 'prune' | 'restore-drill'
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'running'
                    check (status in ('running','success','verified','failed','corrupt','skipped')),
  file_path       text,
  file_size_bytes bigint,
  records_count   integer,
  duration_ms     integer,
  error_message   text,
  details         jsonb not null default '{}'::jsonb,
  triggered_by    text not null default 'cron',
  created_at      timestamptz not null default now()
);
create index if not exists backup_log_type_finished_idx on public.backup_log (backup_type, finished_at desc);
create index if not exists backup_log_status_started_idx on public.backup_log (status, started_at desc);

alter table public.backup_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='backup_log' and policyname='backup_log_admin_select') then
    create policy backup_log_admin_select on public.backup_log for select to authenticated using (has_role('admin'));
  end if;
end $$;
grant select on public.backup_log to authenticated;

-- Cobertura dinâmica: lista as tabelas base do schema public (usada por cron-backup e restore-drill).
create or replace function public.list_public_tables()
returns table(table_name text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$fn$;
revoke all on function public.list_public_tables() from public, anon;
grant execute on function public.list_public_tables() to authenticated, service_role;