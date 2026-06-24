-- Estatistica de lote (NBR 12655): aceitacao por lote. Re-derivado do GEOMAT
-- (lotes_aceitacao + criar_lote_aceitacao + calcular_aceitacao_lote), adaptado a
-- granularidade do GEOLAB: exemplar = amostra = 1 NF; resistencia = maior do par.
create table if not exists public.lotes_aceitacao (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  work_id uuid not null references public.client_works(id),
  numero text not null,
  fck_mpa numeric not null,
  condicao_preparo text not null default 'A',
  idade_controle_dias integer not null default 28,
  periodo_inicio date, periodo_fim date,
  status text not null default 'em_analise',
  n_exemplares integer not null default 0,
  fcm numeric, sd numeric, fck_est numeric, observacao text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_lotes_aceitacao_tenant_work on public.lotes_aceitacao (tenant_id, work_id) where deleted_at is null;
create unique index if not exists uq_lotes_aceitacao_numero on public.lotes_aceitacao (tenant_id, numero) where deleted_at is null;
alter table public.lotes_aceitacao enable row level security;
drop policy if exists sel_lotes_aceitacao on public.lotes_aceitacao;
create policy sel_lotes_aceitacao on public.lotes_aceitacao for select using (public.is_tenant_member(tenant_id));
drop policy if exists ins_lotes_aceitacao on public.lotes_aceitacao;
create policy ins_lotes_aceitacao on public.lotes_aceitacao for insert with check (public.is_tenant_writer(tenant_id));
drop policy if exists upd_lotes_aceitacao on public.lotes_aceitacao;
create policy upd_lotes_aceitacao on public.lotes_aceitacao for update using (public.is_tenant_writer(tenant_id)) with check (public.is_tenant_writer(tenant_id));
drop trigger if exists trg_lotes_aceitacao_updated on public.lotes_aceitacao;
create trigger trg_lotes_aceitacao_updated before update on public.lotes_aceitacao for each row execute function public.set_updated_at();
-- RPCs (corpo completo no banco; ver migration aplicada). Coleta por amostra; NBR 12655.
-- calcular_aceitacao_lote(uuid): n>=20 total (fcm-1.65*Sd); 6<=n<20 parcial 2*(sum f1..f(m-1))/(m-1)-f(m), m=n/2; n<6 insuficiente.
-- criar_lote_aceitacao(jsonb): numera LOTE-AAAA-NNNNNN + chama calcular.
