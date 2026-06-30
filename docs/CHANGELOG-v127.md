# CHANGELOG v127 — Escopo de construtora para traços (obra › construtora › catálogo)

## Banco — migration 108 (já aplicada via MCP)
- `operational_materials.client_id` (FK lab_clients, anulável). Escopo do traço pela combinação:
  `work_id` setado = traço da obra · `client_id` setado (work_id null) = traço da construtora · ambos nulos = catálogo do lab.
- Backfill: traços de obra herdaram `client_id` = construtora da obra (9/9 no LabTest; 0 órfãos).
- Índice parcial `(tenant_id, client_id)`.

## Frontend
- **Cadeia de escopo nos seletores de traço** (Nova programação, Central de concretagens, Detalhe da concretagem):
  o dropdown recebe a obra + a construtora e mostra `traço da obra OU traços da construtora OU catálogo do lab` —
  nunca os de outra construtora. Opções **agrupadas por origem** ("Desta obra / Da construtora / Catálogo do lab")
  via o novo componente `TracoOptions`.
- **Materiais e ensaios (catálogo de traços):**
  - **Picker de escopo** no formulário: Catálogo do laboratório / Construtora / Obra (com seleção da construtora e da obra).
  - **Filtro por construtora** na listagem + **badge de origem** por traço (Obra / Construtora / Catálogo).
  - **Duplicar**: clona um traço para reaproveitar em outra obra ou promover ao nível da construtora
    (abre o formulário pré-preenchido; troca-se o escopo e salva).
- `createTracoObra` (assistente de nova obra) deriva e grava o `client_id` da obra automaticamente —
  a obra já enxerga os traços da sua construtora (herança automática).

## Verificado vivo (LabTest)
- "Vibra Vila Carrão" → seletor com **5** traços: 2 da própria obra + 2 da obra irmã "Vibra João Dias"
  (mesma construtora Vibra) + 1 do catálogo; **0** da "Isa Brooklin" (outra construtora).
  Confirma: traço repete entre as obras da construtora, isolado entre construtoras.

CACHE_NAME=consultegeo-geolab-v127 · APP_VERSION=v127
