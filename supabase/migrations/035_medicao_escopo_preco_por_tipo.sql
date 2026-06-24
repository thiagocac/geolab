-- 035: medição por escopo (contrato/cliente/obra) + preço por tipo de ensaio. Aplicada via MCP.
alter table if exists public.lab_clients add column if not exists precos jsonb not null default '{}'::jsonb;
alter table if exists public.client_works add column if not exists precos jsonb not null default '{}'::jsonb;
alter table if exists public.medicoes add column if not exists escopo text not null default 'contrato';
alter table if exists public.medicoes add column if not exists escopo_id uuid;
alter table if exists public.medicoes alter column contract_id drop not null;
-- precos jsonb: { ensaios: { "<test_type_id>": { ensaiado, moldado } }, forma, laudo, visita, fixo_mensal }
-- RPC computar_medicao(escopo text, escopo_id uuid, inicio date, fim date, precos jsonb): resolve obras por escopo,
--   conta CP ensaiado/moldado AGRUPADO por material_test_type (preço por tipo), flat p/ forma/laudo/visita/fixo.
--   SECURITY DEFINER + is_tenant_member. (corpo completo aplicado via apply_migration)
