-- 138_ux_traco_codigo_por_escopo (APLICADA 02/07/2026 via MCP) — registro fiel.
create unique index if not exists ux_operational_materials_codigo_escopo
  on public.operational_materials (tenant_id, client_id, work_id, lower(codigo))
  nulls not distinct
  where deleted_at is null and codigo is not null and codigo <> '';
