-- 034: medição/faturamento (v1.1) — preços no contrato + tabela medicoes + RPC computar_medicao. Aplicada via MCP.
alter table if exists public.lab_contracts add column if not exists precos jsonb not null default '{}'::jsonb;
create table if not exists public.medicoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  contract_id uuid not null references public.lab_contracts(id),
  client_id uuid references public.lab_clients(id),
  competencia text, periodo_inicio date not null, periodo_fim date not null,
  status text not null default 'fechada',
  itens jsonb not null default '[]'::jsonb, adicionais jsonb not null default '[]'::jsonb,
  valor_itens numeric not null default 0, valor_adicionais numeric not null default 0, valor_total numeric not null default 0,
  observacoes text, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create index if not exists medicoes_tenant_idx on public.medicoes(tenant_id);
create index if not exists medicoes_contract_idx on public.medicoes(contract_id);
alter table public.medicoes enable row level security;
create policy sel_medicoes on public.medicoes for select to authenticated using (public.is_tenant_member(tenant_id));
create policy ins_medicoes on public.medicoes for insert to authenticated with check (public.is_tenant_writer(tenant_id));
create policy upd_medicoes on public.medicoes for update to authenticated using (public.is_tenant_writer(tenant_id)) with check (public.is_tenant_writer(tenant_id));
create trigger set_medicoes_updated before update on public.medicoes for each row execute function public.set_updated_at();
-- RPC computar_medicao(contract, inicio, fim): conta CP ensaiado/moldado, laudo, formas(cobranca), visita do moldador, fixo mensal × preços. SECURITY DEFINER + is_tenant_member. (corpo completo aplicado via MCP)
