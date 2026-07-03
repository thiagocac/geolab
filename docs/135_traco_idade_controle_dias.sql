-- 135_traco_idade_controle_dias (APLICADA no vivo em 02/07/2026 via MCP) — registro fiel.
alter table public.operational_materials
  add column if not exists idade_controle_dias integer
  constraint operational_materials_idade_controle_chk
  check (idade_controle_dias is null or (idade_controle_dias >= 1 and idade_controle_dias <= 365));
comment on column public.operational_materials.idade_controle_dias is
  'Idade de controle (dias) específica do traço; null = config_lab.idade_controle_default (28). Única idade de aceitação (NBR 12655); idades menores são acompanhamento.';
