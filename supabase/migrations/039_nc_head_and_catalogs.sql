-- Motor de NC (Fase A.1): tabela-cabeca non_conformities (estava ausente) + seed dos catalogos
-- globais (8 classificacoes CLS-001..008, 18 situacoes SIT-01..18, 14 tipos T-01..14).
-- Re-derivado do GEOMAT. + coluna nc_action_templates.acao_projetista (compat do seed).
-- Corpo completo aplicado via MCP em xbdvyvvxvzmcosnekmfv (banco vivo = fonte de verdade).
create table if not exists public.non_conformities (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  work_id uuid references public.client_works(id),
  numero text not null, classification_code text, classification_nome text, tipo_code text, tipo_nome text,
  origem text not null default 'manual', severidade text not null default 'media', status text not null default 'aberta',
  data_abertura date not null default current_date, descricao text, entidade_origem text, entidade_origem_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint non_conformities_tenant_numero_key unique (tenant_id, numero),
  constraint non_conformities_entidade_tipo_key unique (tenant_id, entidade_origem, entidade_origem_id, tipo_code));
alter table public.non_conformities enable row level security;
-- policies sel=is_tenant_member, ins/upd=is_tenant_writer; seed dos catalogos globais (ver banco vivo).
