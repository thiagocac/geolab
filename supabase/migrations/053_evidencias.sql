-- 053_evidencias.sql — Melhoria 1.2 (Ficha · fotos/evidências). Alvo: GEOLAB.
-- NUMERAÇÃO: 053 para seguir o pacote de observabilidade (048–052). Se aplicar as melhorias de forma
-- independente da observabilidade, renumere para o próximo slot livre do repo (o source vai até 047).
-- Aditiva e idempotente. Aplicar via MCP apply_migration. Sem DROP/DELETE físico (soft delete).
-- Convenções: RLS sel=is_tenant_member, escrita=is_tenant_writer; storage por tenant (pasta raiz=tenant_id),
-- mesma forma da policy nc_anexos_rw (042). Bucket 'evidencias' já existe.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid (normalmente já habilitada)

CREATE TABLE IF NOT EXISTS public.evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  concretagem_id uuid REFERENCES public.concretagens(id) ON DELETE SET NULL,
  receipt_id uuid REFERENCES public.material_receipts(id) ON DELETE SET NULL,
  path text NOT NULL,
  tipo text NOT NULL DEFAULT 'foto',
  descricao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_evidencias_tenant  ON public.evidencias (tenant_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evidencias_conc    ON public.evidencias (concretagem_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evidencias_receipt ON public.evidencias (receipt_id)     WHERE deleted_at IS NULL;

ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;

-- RLS na tabela: membro lê; writer (inclui financeiro) escreve. Cliente externo não acessa.
DROP POLICY IF EXISTS evidencias_sel ON public.evidencias;
CREATE POLICY evidencias_sel ON public.evidencias FOR SELECT USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS evidencias_ins ON public.evidencias;
CREATE POLICY evidencias_ins ON public.evidencias FOR INSERT WITH CHECK (public.is_tenant_writer(tenant_id));
DROP POLICY IF EXISTS evidencias_upd ON public.evidencias;
CREATE POLICY evidencias_upd ON public.evidencias FOR UPDATE
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_writer(tenant_id));

-- Storage: leitura/escrita no bucket 'evidencias' escopada por tenant (pasta raiz = tenant_id).
DROP POLICY IF EXISTS evidencias_rw ON storage.objects;
CREATE POLICY evidencias_rw ON storage.objects FOR ALL
  USING (bucket_id = 'evidencias' AND public.is_tenant_member(nullif((storage.foldername(name))[1], '')::uuid))
  WITH CHECK (bucket_id = 'evidencias' AND public.is_tenant_member(nullif((storage.foldername(name))[1], '')::uuid));

-- FIM 053. FE (próxima fatia): concretagem.ts (uploadEvidencia/listEvidencias/signedEvidencia) +
-- galeria em ConcretagemDetalhePage. Caminho sugerido: evidencias/<tenant>/conc/<concId>/<ts>-<arquivo>.
