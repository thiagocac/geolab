-- 108: escopo de construtora para tracos. APLICADA via MCP em xbdvyvvxvzmcosnekmfv.
alter table public.operational_materials add column if not exists client_id uuid references public.lab_clients(id);
comment on column public.operational_materials.client_id is 'Escopo de construtora (lab_clients). NULL+work_id NULL = catalogo; NULL+work_id setado = traco de obra; setado+work_id NULL = traco da construtora.';
update public.operational_materials om set client_id = cw.client_id
  from public.client_works cw where om.work_id = cw.id and om.client_id is null and cw.client_id is not null;
create index if not exists operational_materials_client_idx on public.operational_materials (tenant_id, client_id) where client_id is not null;
