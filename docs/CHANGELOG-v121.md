# CHANGELOG v121 — Onda 1 + Onda 2 (GeoCon→GEOLAB), frontend cumulativo

Renumerado de v120 (colidia com a timeline da Onda 1). Frontend vivo = v116.

## Backend (aplicado via MCP em xbdvyvvxvzmcosnekmfv — NÃO entra nos zips)
- Onda 1: 093 audit_log + trigger em 14 tabelas; 094 timeline RPCs.
- Onda 2 (MOD-DOCGATE): 095 matriz documental (lab_document_types/_requirements/_documents/_events + RLS + seed); 096 view v_lab_document_conformity + RPCs list_docgate_conformity/docgate_laudo_blocks/can_emit_lab_report/assert_can_emit_lab_report; 097 seed dos tenants ativos.
- EF generate-laudo-ensaio-pdf: gate técnico (422 docgate_laudo_bloqueado) — deploy conforme decisão do Thiago sobre o bloqueio por operador.

## Frontend (entra nos zips v121)
- Onda 1: tela /gestao/timeline + src/lib/api/timeline.ts (auditoria + linha do tempo).
- Onda 2: tela /gestao/documentos (DocGatePage) + src/lib/api/docgate.ts (matriz documental, conformidade, pré-checagem de bloqueios por concretagem).
- src/App.tsx + src/components/Layout.tsx: rotas e menu de Timeline e Documentos.
- Bump conjunto sw.js + core.ts → v121.
