# INSTRUÇÕES — Patch v136 (UI de documentos na DocGate)

Patch **cumulativo** sobre v135 (se houver release paralela mais nova, prefira o **completo-v136**).

## Arquivos do patch (frontend — sem mudança de banco)
- `public/sw.js` · `src/lib/telemetry/core.ts`        — bump v136
- `src/lib/api/docgate.ts`                            — anexar/decidir/signed (PostgREST + storage)
- `src/pages/gestao/DocGatePage.tsx`                  — ações Anexar/Baixar/Aprovar/Recusar + modais
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v136.md`

## Backend
- **Sem migration.** Usa as tabelas/policies da Onda 2 (lab_documents/events) e o bucket `anexos` (policy nc_anexos_rw, path por tenant).

## Gate (rodado nesta sessão): check-source OK · tsc 0 erros · vitest 23/23 · vite build OK
