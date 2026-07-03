-- 133: RPC consolidada da tela de Pendencias (Fase 1). Uma passada, tenant-scoped.
-- Aplicada via MCP em xbdvyvvxvzmcosnekmfv (02/07/2026). Registro para o repo.
-- Reusa rompimentos_resumo (pendente/atrasado/insatisfatorio, com a logica da idade de controle)
-- e soma: CP a romper hoje, programacao sem caminhao, laudo aguardando (status<>'emitido'), NC aberta.
-- Retorna JSONB { chave: {count, sev} }; o front colapsa 0 e filtra por papel. SECURITY DEFINER +
-- is_tenant_member (helper exige p_tenant, divergencia GEOMAT). Verificado: guard barra sem member;
-- EXECUTE so authenticated (sem PUBLIC/anon, licao da 127). Aditiva.

create or replace function public.pendencias_resumo(p_tenant uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_romp record; v_prog_sem_caminhao int := 0; v_laudo_aprovar int := 0; v_nc_aberta int := 0; v_hoje int := 0;
begin
  if not is_tenant_member(p_tenant) then raise exception 'sem acesso ao laboratorio' using errcode='42501'; end if;
  select * into v_romp from public.rompimentos_resumo(p_tenant);
  select count(*) into v_hoje from corpos_prova c
   where c.tenant_id=p_tenant and c.deleted_at is null and c.situacao='pendente' and c.data_prevista_rompimento=current_date;
  select count(*) into v_prog_sem_caminhao from concretagens k
   where k.tenant_id=p_tenant and k.deleted_at is null
     and not exists (select 1 from material_receipts mr where mr.concretagem_id=k.id and mr.deleted_at is null);
  select count(*) into v_laudo_aprovar from lab_reports lr
   where lr.tenant_id=p_tenant and lr.deleted_at is null and lr.status <> 'emitido';
  select count(*) into v_nc_aberta from non_conformities nc
   where nc.tenant_id=p_tenant and nc.deleted_at is null and nc.status='aberta';
  return jsonb_build_object(
    'cp_hoje',           jsonb_build_object('count', coalesce(v_hoje,0),                'sev','warning'),
    'cp_atrasado',       jsonb_build_object('count', coalesce(v_romp.atrasado,0),       'sev','danger'),
    'cp_pendente',       jsonb_build_object('count', coalesce(v_romp.pendente,0),       'sev','info'),
    'insatisfatorio',    jsonb_build_object('count', coalesce(v_romp.insatisfatorio,0), 'sev','danger'),
    'prog_sem_caminhao', jsonb_build_object('count', coalesce(v_prog_sem_caminhao,0),   'sev','warning'),
    'laudo_aprovar',     jsonb_build_object('count', coalesce(v_laudo_aprovar,0),       'sev','warning'),
    'nc_aberta',         jsonb_build_object('count', coalesce(v_nc_aberta,0),           'sev','danger'));
end; $function$;

revoke execute on function public.pendencias_resumo(uuid) from public, anon;
grant execute on function public.pendencias_resumo(uuid) to authenticated;
