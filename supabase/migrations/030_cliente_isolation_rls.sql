-- 030: isolamento do papel 'cliente' (portal). Aplicada no banco vivo via MCP.
-- 'cliente' deixa de ser membro genérico -> bloqueado nas ~40 sel_ por is_tenant_member.
-- Libera self-read (members/member_obras/tenants) + leituras escopadas por obra. is_tenant_writer é independente.
create or replace function public.is_tenant_member(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members where auth_id=auth.uid() and tenant_id=p_tenant_id and active and deleted_at is null and coalesce(role,'') <> 'cliente')
$$;
create or replace function public.select_tenant(p_tenant_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where auth_id=auth.uid() and tenant_id=p_tenant_id and active and deleted_at is null) then
    raise exception 'sem vínculo com o laboratório'; end if;
  update public.members set is_selected = (tenant_id = p_tenant_id) where auth_id=auth.uid() and deleted_at is null;
end $$;
drop policy if exists sel_members on public.members;
create policy sel_members on public.members for select to public using (public.is_tenant_member(tenant_id) or auth_id = auth.uid());
drop policy if exists sel_member_obras on public.member_obras;
create policy sel_member_obras on public.member_obras for select to public
  using (public.is_tenant_member(tenant_id) or exists (select 1 from public.members m where m.id=member_obras.member_id and m.auth_id=auth.uid() and m.deleted_at is null));
drop policy if exists sel_tenants on public.tenants;
create policy sel_tenants on public.tenants for select to public
  using (public.is_tenant_member(id) or public.has_role('admin_consulte') or exists (select 1 from public.members m where m.tenant_id=tenants.id and m.auth_id=auth.uid() and m.active and m.deleted_at is null));
drop policy if exists client_works_client_portal_read on public.client_works;
create policy client_works_client_portal_read on public.client_works for select to authenticated using (public.member_can_access_work(id));
drop policy if exists concretagens_client_portal_read on public.concretagens;
create policy concretagens_client_portal_read on public.concretagens for select to authenticated using (public.member_can_access_work(work_id));
drop policy if exists lab_reports_client_portal_read on public.lab_reports;
create policy lab_reports_client_portal_read on public.lab_reports for select to authenticated using (work_id is not null and public.member_can_access_work(work_id));
drop policy if exists lab_clients_client_portal_read on public.lab_clients;
create policy lab_clients_client_portal_read on public.lab_clients for select to authenticated
  using (exists (select 1 from public.member_obras mo join public.client_works w on w.id=mo.work_id join public.members m on m.id=mo.member_id
    where m.auth_id=auth.uid() and m.deleted_at is null and mo.deleted_at is null and w.client_id=lab_clients.id));
