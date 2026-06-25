-- 054_magic_link_aprovacao_laudo.sql — Melhoria 3.2 (Laudos · aprovação por magic link). Alvo: GEOLAB.
-- NUMERAÇÃO: 054, seguindo 053 (evidências). O vivo versiona por timestamp; o nº do arquivo é só ordem do repo.
-- NÃO aplicado por mim — aplicar via MCP apply_migration (workflow do projeto: uma alteração por vez).
--
-- Reusa a infra existente (introspecção read-only do vivo xbdvyvvxvzmcosnekmfv):
--   • magic_links(tenant_id, token_hash[sha256 hex], purpose, entity_table, entity_id, expires_at, consumed_at, created_by)
--   • criar_magic_link(p_purpose,p_entity_table,p_entity_id,p_dias=30) RETURNS text (token cru); só hash é gravado; one-time.
--   • lab_reports(status[text, sem check], approved_at, approved_by, justificativa, data_emissao, revisao, deleted_at, tenant_id)
--   • aprovar_laudo/reabrir_laudo existem mas são gated por auth.uid() (member logado) -> NÃO servem no fluxo anônimo.
--
-- Decisões (honestas):
--   • Vocabulário de status preservado: aprovar->'emitido', devolver/reprovar->'em_revisao'. NÃO há status 'reprovado'
--     no schema; 'reprovar' marca em_revisao com justificativa "[REPROVADO] ..." p/ não criar status órfão que
--     StatusBadge/filtros não reconhecem. Se um dia houver 'reprovado', troque só o ramo reprovar.
--   • approved_by não é setado no aprovar via link (não há member autenticado); fica como estava.
--   • Sem acoplamento a workflow_instances (a aprovação 1-etapa do app age direto em lab_reports.status, como aprovar_laudo).

-- 1) Ampliar a whitelist de purpose do criar_magic_link (CREATE OR REPLACE fiel ao vivo, só +'aprovacao_laudo').
CREATE OR REPLACE FUNCTION public.criar_magic_link(p_purpose text, p_entity_table text, p_entity_id uuid, p_dias integer DEFAULT 30)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_tenant uuid := public.current_tenant_id(); v_token text;
begin
  if v_tenant is null then raise exception 'Sem tenant ativo.' using errcode='28000'; end if;
  if not public.is_tenant_writer(v_tenant) then raise exception 'Sem permissao de escrita.' using errcode='42501'; end if;
  if p_purpose not in ('portal', 'aprovacao_laudo') then raise exception 'purpose invalido' using errcode='22023'; end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.magic_links(tenant_id, token_hash, purpose, entity_table, entity_id, expires_at, created_by)
  values (v_tenant, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_purpose, p_entity_table, p_entity_id, now() + make_interval(days => greatest(1, p_dias)), public.current_member_id());
  return v_token;
end $function$;

-- 2) Consumo one-time do link de aprovação (re-derivado do padrão consume_magic_link do GEOMAT, ramo lab_reports).
--    SECURITY DEFINER: roda como dono (bypassa RLS); a autorização É o token válido. Chamado pela EF via service-role.
CREATE OR REPLACE FUNCTION public.consume_magic_link_laudo(p_token text, p_decision text, p_comment text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_ml public.magic_links;
  v_lr public.lab_reports;
  v_hash text;
  v_status text;
begin
  if p_token is null or length(p_token) < 16 then raise exception 'token invalido' using errcode='22023'; end if;
  if p_decision not in ('aprovar', 'devolver', 'reprovar') then raise exception 'decisao invalida' using errcode='22023'; end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- trava a linha do link p/ evitar corrida de duplo consumo
  select * into v_ml from public.magic_links
    where token_hash = v_hash and purpose = 'aprovacao_laudo' and entity_table = 'lab_reports'
    for update;
  if not found then raise exception 'link invalido' using errcode='22023'; end if;
  if v_ml.consumed_at is not null then raise exception 'link ja utilizado' using errcode='22023'; end if;
  if v_ml.expires_at < now() then raise exception 'link expirado' using errcode='22023'; end if;

  select * into v_lr from public.lab_reports
    where id = v_ml.entity_id and tenant_id = v_ml.tenant_id and deleted_at is null;
  if not found then raise exception 'laudo nao encontrado' using errcode='22023'; end if;

  if p_decision = 'aprovar' then
    update public.lab_reports
      set status = 'emitido', approved_at = now(), updated_at = now(),
          data_emissao = coalesce(data_emissao, current_date)
      where id = v_lr.id returning status into v_status;
  elsif p_decision = 'devolver' then
    update public.lab_reports
      set status = 'em_revisao', approved_at = null, approved_by = null, updated_at = now(),
          justificativa = coalesce(nullif(p_comment, ''), justificativa)
      where id = v_lr.id returning status into v_status;
  else  -- reprovar (ver nota de cabeçalho)
    update public.lab_reports
      set status = 'em_revisao', approved_at = null, approved_by = null, updated_at = now(),
          justificativa = '[REPROVADO] ' || coalesce(nullif(p_comment, ''), '(sem comentario)')
      where id = v_lr.id returning status into v_status;
  end if;

  update public.magic_links set consumed_at = now() where id = v_ml.id;

  return jsonb_build_object('ok', true, 'numero', v_lr.numero, 'revisao', v_lr.revisao, 'status', v_status, 'decision', p_decision);
end $function$;

-- 3) Grants: o consume é chamado pela EF approve-laudo-link via service-role. Fecha p/ anon/authenticated.
REVOKE ALL ON FUNCTION public.consume_magic_link_laudo(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_magic_link_laudo(text, text, text) TO service_role;

-- FIM 054. FE (próxima fatia): página pública /laudo/aprovar/:token + rota App.tsx + laudo.ts criarLinkAprovacao + botão na LaudosPage.
