# CHANGELOG v136 — UI de gestão de documentos na DocGate (gap #2)

## Frontend (sem migration — a Onda 2 já deixou tabelas e policies prontas)
- **Documentos e gate** deixou de ser somente leitura. Por linha da matriz documental:
  - **Anexar / Substituir** — upload do arquivo (bucket `anexos`, path `<tenant_id>/docgate/<requirement>/...`) + título e validade;
    o documento entra como **em análise** e gera evento.
  - **Aprovar / Recusar** (com motivo) — grava `reviewed_by`/`reviewed_at`/`motivo_recusa` e evento; **aprovado** vira **conforme**
    (dentro da validade) e libera o gate de emissão do laudo.
  - **Baixar** — signed URL (120s) aberto via `openDeferredTab` (sem bloqueio de pop-up).
- Ações gateadas por `docgate.gerenciar` (admin/admin_consulte/gestor_qualidade no seed).
- `docgate.ts`: `getRequirementInfo`, `anexarDocumento`, `decidirDocumento`, `signedDocUrl` (PostgREST + storage, RLS por tenant).

## Observação
- As policies de escrita de `lab_documents` são `is_tenant_writer` (qualquer escritor do tenant); o gate fino fica na UI por `docgate.gerenciar`.
  Endurecer a policy para exigir a permissão pode ser feito depois, se desejado.

## Gate de build — rodado nesta sessão (espelho Netlify)
- `check-source` OK · `tsc --noEmit` **0 erros** · `vitest` **23/23** · `vite build` **✓**

CACHE_NAME=consultegeo-geolab-v136 · APP_VERSION=v136
