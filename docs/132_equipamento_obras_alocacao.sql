-- 132: alocacao prensa<->obra (equipamento_obras), espelho estrutural de member_obras.
-- Aplicada via MCP em xbdvyvvxvzmcosnekmfv (02/07/2026). Registro para o repo.
-- Vinculo N-N: uma prensa atende varias obras; uma obra pode ter varias prensas.
-- Semantica SOFT (default e eixo de agenda, nao trava o seletor). Soft-delete + on-conflict-reativa
-- como member_obras. Helpers exigem p_tenant_id (divergencia GEOMAT, igual 129/130).
-- Verificado pos-apply: tabela + 2 policies + 4 indices; set_equipamento_obras com EXECUTE so a
-- authenticated (sem PUBLIC/anon, licao da 127).

create table if not exists public.equipamento_obras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  equipamento_id uuid not null references public.equipamentos(id),
  work_id uuid not null references public.client_works(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists ux_equipamento_obras_par on public.equipamento_obras (equipamento_id, work_id);
create index if not exists ix_equipamento_obras_tenant_work on public.equipamento_obras (tenant_id, work_id) where deleted_at is null;
create index if not exists ix_equipamento_obras_tenant_equip on public.equipamento_obras (tenant_id, equipamento_id) where deleted_at is null;

alter table public.equipamento_obras enable row level security;

drop policy if exists equipamento_obras_select on public.equipamento_obras;
create policy equipamento_obras_select on public.equipamento_obras
  for select using (tenant_id = public.current_tenant_id() and public.is_tenant_member(public.current_tenant_id()));

drop policy if exists equipamento_obras_write on public.equipamento_obras;
create policy equipamento_obras_write on public.equipamento_obras
  for all using (tenant_id = public.current_tenant_id() and public.is_tenant_writer(public.current_tenant_id()))
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_writer(public.current_tenant_id()));

create or replace function public.set_equipamento_obras(p_equipamento_id uuid, p_work_ids uuid[])
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_tenant uuid := public.current_tenant_id();
begin
  if not (public.is_tenant_admin(v_tenant) or public.current_has_permission('equipamento.gerenciar') or public.is_tenant_writer(v_tenant)) then
    raise exception 'Sem permissao para alocar equipamento' using errcode='42501';
  end if;
  if not exists (select 1 from public.equipamentos where id=p_equipamento_id and tenant_id=v_tenant and deleted_at is null) then
    raise exception 'Equipamento nao encontrado no laboratorio';
  end if;
  update public.equipamento_obras set deleted_at=now()
    where equipamento_id=p_equipamento_id and tenant_id=v_tenant and deleted_at is null
      and (p_work_ids is null or work_id <> all(p_work_ids));
  if p_work_ids is not null then
    insert into public.equipamento_obras (tenant_id, equipamento_id, work_id)
    select v_tenant, p_equipamento_id, w from unnest(p_work_ids) w
    on conflict (equipamento_id, work_id) do update set deleted_at=null;
  end if;
end; $function$;

revoke execute on function public.set_equipamento_obras(uuid, uuid[]) from public, anon;
grant execute on function public.set_equipamento_obras(uuid, uuid[]) to authenticated;
