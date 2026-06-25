-- 064: melhorias do portal — classificacao Parcial/Final p/ staff + observabilidade do magic link.
create or replace function public.laudos_parcial_final()
returns table(id uuid, parcial_final text)
language sql stable security definer set search_path to 'public' as $$
  with base as (
    select lr.id from public.lab_reports lr
    where lr.deleted_at is null and public.is_tenant_member(lr.tenant_id)
  ),
  cob as (
    select lres.lab_report_id, cp.amostra_id,
      bool_or(mt.resultado_valor is not null
        and coalesce(mt.idade_dias, cp.idade_dias) = coalesce(mtt.idade_controle, cfg.idade_controle_default, 28)
        and coalesce(mt.idade_unidade, cp.idade_unidade, 'dia') <> 'hora') as tem_controle
    from public.laudo_resultados lres
    join public.material_tests mt on mt.id = lres.material_test_id and mt.deleted_at is null
    join public.corpos_prova cp on cp.id = mt.corpo_prova_id and cp.deleted_at is null
    left join public.material_test_types mtt on mtt.id = cp.material_test_type_id
    left join public.config_lab cfg on cfg.tenant_id = cp.tenant_id
    where lres.deleted_at is null and lres.lab_report_id in (select id from base)
    group by lres.lab_report_id, cp.amostra_id
  ),
  cls as (
    select lab_report_id,
      case when count(*) = 0 then 'sem_resultados'
           when bool_and(tem_controle) then 'final' else 'parcial' end as parcial_final
    from cob group by lab_report_id
  )
  select b.id, coalesce(cls.parcial_final, 'sem_resultados') as parcial_final
  from base b left join cls on cls.lab_report_id = b.id;
$$;

alter table public.magic_links add column if not exists last_access_at timestamptz;
alter table public.magic_links add column if not exists access_count integer not null default 0;

create or replace function public.bump_magic_link_access(p_hash text)
returns void language sql security definer set search_path to 'public' as $$
  update public.magic_links set last_access_at = now(), access_count = coalesce(access_count, 0) + 1 where token_hash = p_hash;
$$;

create or replace function public.revogar_magic_link(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_tenant uuid := public.current_tenant_id();
begin
  if v_tenant is null then raise exception 'Sem tenant ativo.' using errcode='28000'; end if;
  if not public.is_tenant_writer(v_tenant) then raise exception 'Sem permissao.' using errcode='42501'; end if;
  update public.magic_links set consumed_at = coalesce(consumed_at, now()) where id = p_id and tenant_id = v_tenant;
end $$;

create or replace function public.listar_magic_links_portal()
returns table(id uuid, client_id uuid, client_nome text, created_at timestamptz, expires_at timestamptz,
              consumed_at timestamptz, last_access_at timestamptz, access_count integer, ativo boolean)
language sql stable security definer set search_path to 'public' as $$
  select ml.id, ml.entity_id, coalesce(lc.nome_fantasia, lc.razao_social),
         ml.created_at, ml.expires_at, ml.consumed_at, ml.last_access_at, coalesce(ml.access_count, 0),
         (ml.consumed_at is null and ml.expires_at > now())
  from public.magic_links ml
  left join public.lab_clients lc on lc.id = ml.entity_id
  where ml.purpose = 'portal' and public.is_tenant_writer(ml.tenant_id)
  order by ml.created_at desc;
$$;

revoke all on function public.laudos_parcial_final() from public;
revoke all on function public.bump_magic_link_access(text) from public;
revoke all on function public.revogar_magic_link(uuid) from public;
revoke all on function public.listar_magic_links_portal() from public;
grant execute on function public.laudos_parcial_final() to authenticated;
grant execute on function public.bump_magic_link_access(text) to service_role;
grant execute on function public.revogar_magic_link(uuid) to authenticated;
grant execute on function public.listar_magic_links_portal() to authenticated;
