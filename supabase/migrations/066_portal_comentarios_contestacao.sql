-- 066: comentários e contestação de laudo (C1/C2) — thread laboratório <-> cliente.
create table if not exists public.portal_comentarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, work_id uuid not null, lab_report_id uuid, concretagem_id uuid,
  autor_member_id uuid, autor_nome text,
  autor_tipo text not null check (autor_tipo in ('cliente','staff')),
  tipo text not null default 'comentario' check (tipo in ('comentario','contestacao')),
  mensagem text not null, resolvido_at timestamptz, resolvido_by uuid,
  created_at timestamptz not null default now(), deleted_at timestamptz
);
alter table public.portal_comentarios enable row level security;
create index if not exists idx_portal_coment_report on public.portal_comentarios(lab_report_id) where deleted_at is null;
create index if not exists idx_portal_coment_work on public.portal_comentarios(work_id) where deleted_at is null;
drop policy if exists pc_client_read on public.portal_comentarios;
drop policy if exists pc_staff_read on public.portal_comentarios;
create policy pc_client_read on public.portal_comentarios for select to authenticated using (public.member_can_access_work(work_id));
create policy pc_staff_read on public.portal_comentarios for select using (public.is_tenant_member(tenant_id));

create or replace function public.postar_comentario_portal(p_work_id uuid, p_mensagem text, p_lab_report_id uuid default null, p_concretagem_id uuid default null, p_tipo text default 'comentario')
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid; v_member uuid; v_role text; v_nome text; v_autor text; v_id uuid;
begin
  if coalesce(btrim(p_mensagem), '') = '' then raise exception 'Mensagem vazia.'; end if;
  if not public.member_can_access_work(p_work_id) then raise exception 'Sem acesso a esta obra.' using errcode = '42501'; end if;
  select tenant_id into v_tenant from public.client_works where id = p_work_id and deleted_at is null;
  if v_tenant is null then raise exception 'Obra nao encontrada.'; end if;
  select id, role, full_name into v_member, v_role, v_nome from public.members where auth_id = auth.uid() and tenant_id = v_tenant and active and deleted_at is null order by is_selected desc limit 1;
  v_autor := case when v_role = 'cliente' then 'cliente' else 'staff' end;
  insert into public.portal_comentarios(tenant_id, work_id, lab_report_id, concretagem_id, autor_member_id, autor_nome, autor_tipo, tipo, mensagem)
  values (v_tenant, p_work_id, p_lab_report_id, p_concretagem_id, v_member, v_nome, v_autor, case when p_tipo = 'contestacao' then 'contestacao' else 'comentario' end, btrim(p_mensagem))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.resolver_comentario_portal(p_id uuid, p_resolvido boolean default true)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.portal_comentarios where id = p_id and deleted_at is null;
  if v_tenant is null then raise exception 'Comentario nao encontrado.'; end if;
  if not public.is_tenant_writer(v_tenant) then raise exception 'Sem permissao.' using errcode = '42501'; end if;
  update public.portal_comentarios set resolvido_at = case when p_resolvido then now() else null end, resolvido_by = case when p_resolvido then public.current_member_id() else null end where id = p_id;
end $$;

revoke all on function public.postar_comentario_portal(uuid, text, uuid, uuid, text) from public;
revoke all on function public.resolver_comentario_portal(uuid, boolean) from public;
grant execute on function public.postar_comentario_portal(uuid, text, uuid, uuid, text) to authenticated;
grant execute on function public.resolver_comentario_portal(uuid, boolean) to authenticated;
