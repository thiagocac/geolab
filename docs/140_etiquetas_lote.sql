-- 140_etiquetas_lote (fiel ao vivo, aplicada em xbdvyvvxvzmcosnekmfv)
-- Estoque de etiquetas de CP pré-numeradas. origem 'avulsa' = grande sequência sem vínculo;
-- 'concretagem' = previstos + folga. Numeração NNNNNN/AA reinicia por ano, por laboratório.
-- Modelo por LOTE (faixa contígua), sem linha por etiqueta (enxuto v1).
create table if not exists public.etiqueta_lotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  origem text not null default 'avulsa' check (origem in ('avulsa','concretagem')),
  concretagem_id uuid references public.concretagens(id),
  ano integer not null,
  seq_inicial integer not null,
  seq_final integer not null,
  quantidade integer not null check (quantidade >= 0),
  extra integer not null default 0 check (extra >= 0),
  total integer generated always as (quantidade + extra) stored,
  caminhoes_previstos integer,
  caminhoes_extra integer,
  cps_por_caminhao integer,
  observacao text,
  status text not null default 'ativo' check (status in ('ativo','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,
  constraint etiqueta_lotes_faixa_chk check (seq_final >= seq_inicial),
  constraint etiqueta_lotes_total_chk check (seq_final - seq_inicial + 1 = quantidade + extra)
);
create index if not exists idx_etiqueta_lotes_tenant_ano on public.etiqueta_lotes(tenant_id, ano, seq_final) where deleted_at is null;
create index if not exists idx_etiqueta_lotes_concretagem on public.etiqueta_lotes(concretagem_id) where concretagem_id is not null;
create index if not exists idx_etiqueta_lotes_tenant_created on public.etiqueta_lotes(tenant_id, created_at desc) where deleted_at is null;
alter table public.etiqueta_lotes enable row level security;
create policy sel_etiqueta_lotes on public.etiqueta_lotes for select using (public.is_tenant_member(tenant_id));
create policy ins_etiqueta_lotes on public.etiqueta_lotes for insert with check (public.is_tenant_writer(tenant_id));
create policy upd_etiqueta_lotes on public.etiqueta_lotes for update using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_writer(tenant_id));
grant select, insert, update on public.etiqueta_lotes to authenticated;
revoke all on public.etiqueta_lotes from anon;

-- Reserva atômica de faixa contígua (advisory lock por tenant+ano). Ver migration para o corpo completo.
-- public.gerar_etiquetas(p_quantidade, p_extra, p_concretagem_id, p_observacao,
--                        p_caminhoes_previstos, p_caminhoes_extra, p_cps_por_caminhao) returns jsonb
-- public.cancelar_etiqueta_lote(p_id uuid) returns void
-- Ambas SECURITY DEFINER + is_tenant_writer; EXECUTE revogado de public/anon, concedido a authenticated.
