-- 069 (G2): medição/faturamento visível ao cliente (read-only, escopo = clientes das obras que o membro acessa).
create or replace function public.portal_financeiro()
returns table(tipo text, id uuid, numero text, competencia text, periodo_inicio date, periodo_fim date, valor numeric, status text, data_emissao date, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with cli as (
    select distinct w.client_id as cid from public.client_works w
    where w.deleted_at is null and w.client_id is not null and public.member_can_access_work(w.id)
  )
  select 'fatura'::text, f.id, f.numero::text, f.competencia::text, null::date, null::date, f.valor, f.status::text, f.data_emissao, f.created_at
  from public.faturas f where f.deleted_at is null and f.client_id in (select cid from cli)
  union all
  select 'medicao'::text, m.id, null::text, m.competencia::text, m.periodo_inicio, m.periodo_fim, m.valor_total, m.status::text, null::date, m.created_at
  from public.medicoes m where m.deleted_at is null and m.client_id in (select cid from cli)
  order by created_at desc limit 500;
$$;
revoke all on function public.portal_financeiro() from public;
grant execute on function public.portal_financeiro() to authenticated;
