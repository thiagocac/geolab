-- 029: campos dinâmicos de concretagem/recebimento + soft-delete de vínculo de obra + helper de acesso por obra.
-- Aditiva/idempotente. Aplicada no banco vivo via MCP.
alter table if exists public.config_lab add column if not exists concretagem_campos jsonb not null default '{}'::jsonb;
alter table if exists public.member_obras add column if not exists deleted_at timestamptz;
create unique index if not exists member_obras_member_work_active_uidx on public.member_obras(member_id, work_id) where deleted_at is null;
update public.config_lab set
  concretagem_campos = '{"traco_fck":true,"fornecedor":true,"data_hora":true,"local_peca":true,"volume_programado":true,"dimensao_cp":true,"moldador":true,"clima":true,"temperatura_ambiente":true,"bombeado":true,"observacoes":true,"padrao_moldagem":true}'::jsonb || coalesce(concretagem_campos,'{}'::jsonb),
  recebimento_campos = '{"nota_fiscal":true,"placa":true,"motorista":true,"volume_m3":true,"horarios_transporte":true,"horarios_descarga":true,"hora_moldagem":true,"slump":true,"temperatura_concreto":true,"agua_adicionada":true,"rejeicao":true,"elementos_concretados":true,"observacoes_caminhao":true}'::jsonb || coalesce(recebimento_campos,'{}'::jsonb),
  laudo_campos = '{"dados_concreto":true,"recebimento":true,"elemento":true,"usina":true,"temperatura":true,"moldador":true,"observacoes":true}'::jsonb || coalesce(laudo_campos,'{}'::jsonb);
create or replace function public.member_can_access_work(p_work_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m join public.client_works w on w.tenant_id=m.tenant_id and w.id=p_work_id
    where m.auth_id=auth.uid() and m.active=true and m.deleted_at is null
      and (m.role <> 'cliente' or exists (select 1 from public.member_obras mo where mo.member_id=m.id and mo.work_id=p_work_id and mo.deleted_at is null)));
$$;
grant execute on function public.member_can_access_work(uuid) to authenticated;
revoke execute on function public.member_can_access_work(uuid) from public, anon;
drop policy if exists member_obras_writer_manage on public.member_obras;
create policy member_obras_writer_manage on public.member_obras for all to authenticated
  using (public.is_tenant_writer(tenant_id)) with check (public.is_tenant_writer(tenant_id));
-- RLS já habilitada nestas tabelas (idempotente; satisfaz o guard de check-source).
alter table if exists public.config_lab enable row level security;
alter table if exists public.member_obras enable row level security;
alter table if exists public.concretagens enable row level security;
