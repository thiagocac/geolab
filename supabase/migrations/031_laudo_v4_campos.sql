-- 031: campos do laudo v4 — assinaturas/local no config_lab + composição do traço. Aplicada via MCP.
alter table if exists public.config_lab
  add column if not exists local_ensaio text,
  add column if not exists art_numero text,
  add column if not exists gerente_qualidade text,
  add column if not exists crea_gq text;
alter table if exists public.operational_materials
  add column if not exists componentes jsonb not null default '{}'::jsonb;
alter table if exists public.config_lab enable row level security;
alter table if exists public.operational_materials enable row level security;
