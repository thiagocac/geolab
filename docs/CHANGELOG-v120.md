# GEOLAB v120 — Onda 2 GeoCon port: documentos e gate de laudo

Base: v119/Onda 1.

## Frontend

- Nova página `/gestao/documentos` para visualizar a matriz documental do laboratório.
- Pré-checagem de gate por `concretagem_id` usando a RPC `docgate_laudo_blocks`.
- Menu lateral em Operação interna: **Documentos e gate**.
- API `src/lib/api/docgate.ts` com mapeamento seguro dos resultados das RPCs.
- Bump conjunto de `CACHE_NAME` e `APP_VERSION` para `v120`.

## Backend separado

- `095_docgate_foundation.sql`: tabelas `lab_document_types`, `lab_document_requirements`, `lab_documents`, `lab_document_events`, RLS e seed helper.
- `096_docgate_conformity_and_laudo_gate.sql`: view `v_lab_document_conformity`, RPCs de conformidade e gate de emissão de laudo.
- `097_docgate_seed_current_tenants.sql`: seed idempotente dos requisitos/documentos padrão para tenants ativos.
- EF `generate-laudo-ensaio-pdf`: patch para chamar `docgate_laudo_blocks` antes de gerar o PDF.

## Observações

- O gate bloqueante da v1 cobre equipamento sem calibração vigente e operador informado sem certificação vigente.
- Ausência de equipamento/operador entra como aviso para não interromper bases legadas sem antes corrigir cadastro.
- A validação em branch Supabase deve ser feita pelo Claude antes de aplicar em produção.
