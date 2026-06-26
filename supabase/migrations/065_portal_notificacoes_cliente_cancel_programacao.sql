-- 065: notificações in-app do cliente (A1/A2) + cancelar programação pendente (C3).
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid, work_id uuid not null,
  tipo text not null, titulo text not null, corpo text, deep_link text,
  entity_table text, entity_id uuid, lida_at timestamptz, created_by uuid,
  created_at timestamptz not null default now(), deleted_at timestamptz
);
alter table public.client_notifications enable row level security;
create index if not exists idx_client_notif_work on public.client_notifications(work_id) where deleted_at is null;
drop policy if exists cn_client_read on public.client_notifications;
drop policy if exists cn_staff_read on public.client_notifications;
create policy cn_client_read on public.client_notifications for select to authenticated using (public.member_can_access_work(work_id));
create policy cn_staff_read on public.client_notifications for select using (public.is_tenant_member(tenant_id));

create or replace function public.notificar_cliente(p_work_id uuid, p_tipo text, p_titulo text, p_corpo text default null, p_deep_link text default null, p_entity_table text default null, p_entity_id uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid; v_client uuid; v_id uuid; v_zero uuid := '00000000-0000-0000-0000-000000000000';
begin
  select tenant_id, client_id into v_tenant, v_client from public.client_works where id = p_work_id and deleted_at is null;
  if v_tenant is null then return null; end if;
  if not public.is_tenant_writer(v_tenant) then raise exception 'Sem permissao.' using errcode = '42501'; end if;
  if exists (select 1 from public.client_notifications where work_id = p_work_id and tipo = p_tipo and coalesce(entity_id, v_zero) = coalesce(p_entity_id, v_zero) and lida_at is null and deleted_at is null and created_at > now() - interval '12 hours') then return null; end if;
  insert into public.client_notifications(tenant_id, client_id, work_id, tipo, titulo, corpo, deep_link, entity_table, entity_id, created_by)
  values (v_tenant, v_client, p_work_id, p_tipo, p_titulo, p_corpo, p_deep_link, p_entity_table, p_entity_id, public.current_member_id()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.marcar_notificacao_cliente(p_id uuid default null, p_todas boolean default false)
returns void language sql security definer set search_path to 'public' as $$
  update public.client_notifications set lida_at = now() where lida_at is null and deleted_at is null and public.member_can_access_work(work_id) and (p_todas or id = p_id);
$$;

create or replace function public.cancelar_programacao_cliente(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_work uuid; v_status text;
begin
  select work_id, status::text into v_work, v_status from public.concretagens where id = p_id and deleted_at is null;
  if v_work is null then raise exception 'Programacao nao encontrada.'; end if;
  if not public.member_can_access_work(v_work) then raise exception 'Sem acesso a esta obra.' using errcode = '42501'; end if;
  if v_status <> 'pendente' then raise exception 'So e possivel cancelar uma programacao ainda pendente.'; end if;
  update public.concretagens set status = 'cancelada', updated_at = now() where id = p_id;
end $$;

revoke all on function public.notificar_cliente(uuid, text, text, text, text, text, uuid) from public;
revoke all on function public.marcar_notificacao_cliente(uuid, boolean) from public;
revoke all on function public.cancelar_programacao_cliente(uuid) from public;
grant execute on function public.notificar_cliente(uuid, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.marcar_notificacao_cliente(uuid, boolean) to authenticated;
grant execute on function public.cancelar_programacao_cliente(uuid) to authenticated;
