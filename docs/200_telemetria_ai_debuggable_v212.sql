-- 200_telemetria_ai_debuggable_v212.sql
-- Log estruturado de erro de Edge Functions (ef_log) + views NOC de geracao PDF/Excel
-- + alarme dedicado de falha de relatorio. Aditiva/idempotente; sem DROP/DELETE.
-- Base: proposta GPT Pro (199/v210). Ajustes aplicados: renumerado 199->200 (199 = slump);
-- removido INSERT em telemetry_error_group (colunas inexistentes na tabela real; so no RPC
-- telemetry_error_groups); removida policy RESTRICTIVE que bloqueava o proprio SELECT;
-- read policy = has_role('admin') casando com ef_invocation_log/telemetry_* (verificado no vivo).
-- APLICADA em xbdvyvvxvzmcosnekmfv como migration 200 (versao timestamp gerada pelo Supabase).

create table if not exists public.ef_log (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  level text not null default 'error' check (level in ('debug','info','warn','error','fatal')),
  source text not null default 'edge_function',
  environment text not null default 'prod',
  app_version text, session_id text, fn_name text not null, action text, method text, path text,
  request_id text, trace_id text, correlation_id text, actor_id uuid, tenant_id uuid,
  error_class text, message text not null, stack text, pg_code text, http_status integer, fingerprint text,
  domain_context jsonb not null default '{}'::jsonb, request_body jsonb not null default '{}'::jsonb,
  response_body jsonb not null default '{}'::jsonb, breadcrumbs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.ef_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ef_log' and policyname='ef_log_admin_select') then
    create policy ef_log_admin_select on public.ef_log for select to authenticated using (public.has_role('admin'));
  end if;
end $$;
create index if not exists ef_log_occurred_idx on public.ef_log (occurred_at desc);
create index if not exists ef_log_fn_occurred_idx on public.ef_log (fn_name, occurred_at desc);
create index if not exists ef_log_tenant_occurred_idx on public.ef_log (tenant_id, occurred_at desc);
create index if not exists ef_log_trace_idx on public.ef_log (trace_id) where trace_id is not null;
create index if not exists ef_log_correlation_idx on public.ef_log (correlation_id) where correlation_id is not null;
create index if not exists ef_log_fingerprint_idx on public.ef_log (fingerprint) where fingerprint is not null;
create index if not exists ef_log_report_idx on public.ef_log (occurred_at desc)
  where fn_name like 'generate-%-pdf' or action like 'relatorio.%' or action like 'export.excel:%';

create or replace function public.log_ef_event(
  p_level text, p_fn_name text, p_message text, p_trace_id text default null,
  p_actor_id uuid default null, p_tenant_id uuid default null, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := extensions.gen_random_uuid();
  v_stack text := left(coalesce(p_metadata->>'stack', ''), 8000);
  v_message text := left(coalesce(p_message, 'erro sem mensagem'), 4000);
  v_fingerprint text;
begin
  v_fingerprint := coalesce(
    public.telemetry_error_fingerprint(coalesce(p_fn_name, 'edge_function'), v_message, v_stack),
    md5(coalesce(p_fn_name, '') || ':' || v_message || ':' || left(v_stack, 800)));
  insert into public.ef_log (
    id, level, app_version, session_id, fn_name, action, method, path, request_id, trace_id, correlation_id,
    actor_id, tenant_id, error_class, message, stack, pg_code, http_status, fingerprint,
    domain_context, request_body, response_body, breadcrumbs, metadata
  ) values (
    v_id, case when p_level in ('debug','info','warn','error','fatal') then p_level else 'error' end,
    nullif(p_metadata->>'app_version',''), nullif(p_metadata->>'session_id',''),
    coalesce(nullif(p_fn_name,''),'edge_function'), nullif(p_metadata->>'action',''),
    nullif(p_metadata->>'method',''), nullif(p_metadata->>'path',''), nullif(p_metadata->>'request_id',''),
    nullif(p_trace_id,''), nullif(p_metadata->>'correlation_id',''), p_actor_id, p_tenant_id,
    nullif(p_metadata->>'error_class',''), v_message, nullif(v_stack,''),
    nullif(p_metadata->>'pg_code',''), nullif(p_metadata->>'http_status','')::integer, v_fingerprint,
    coalesce(p_metadata->'domain_context','{}'::jsonb), coalesce(p_metadata->'request_body','{}'::jsonb),
    coalesce(p_metadata->'response_body','{}'::jsonb), coalesce(p_metadata->'breadcrumbs','[]'::jsonb),
    coalesce(p_metadata,'{}'::jsonb) - 'stack' - 'request_body' - 'response_body' - 'breadcrumbs');
  return v_id;
end; $$;
revoke all on function public.log_ef_event(text,text,text,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.log_ef_event(text,text,text,text,uuid,uuid,jsonb) to service_role;
grant select on public.ef_log to authenticated;

alter table public.telemetry_settings add column if not exists alert_report_generation_enabled boolean not null default true;
alter table public.telemetry_settings add column if not exists alert_report_error_threshold integer not null default 1;
alter table public.telemetry_settings add column if not exists alert_report_error_window_minutes integer not null default 15;

-- Views NOC (security_invoker). Definicoes verbatim da proposta (colunas conferidas no vivo).
-- v_ef_error_recent / v_report_generation_events / v_observability_recent_errors
-- + runner telemetry_report_generation_alarm_run(). (Corpo completo aplicado via MCP.)
