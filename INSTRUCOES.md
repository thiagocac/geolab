# GEOLAB v45 — Laudo ↔ Lote: fck,est estatístico (NBR 12655) no laudo

**Backend-only** (EF redeployada; sem mudança de frontend → cache permanece `consultegeo-geolab-v44`).

## O que muda
A EF `generate-laudo-ensaio-pdf` (redeployada **v6, sha 05ff0c12…**) passa a imprimir a **aceitação estatística de lote** quando existe um lote:

- **Auto-match**: ao gerar o laudo de uma concretagem, a EF procura um `lotes_aceitacao` da **mesma obra + mesmo fck** (mais recente, não excluído). Aceita também um **`lote_id` explícito** no corpo da requisição (seleção manual — picker no front é follow-up pequeno).
- **Quando há lote com fck,est** (n ≥ 6): a faixa de Aceitação mostra `fck,est = <valor> MPa ≥/< fck` com `n` e `Sd`, o veredito CONFORME/NÃO CONFORME vira o do lote, e a observação detalha `lote, n, fcm, Sd, fck,est` (ABNT NBR 12655).
- **Quando não há lote (ou n < 6)**: cai no comportamento por exemplar (maior do par), agora com texto **honesto** — "lote ainda sem amostragem suficiente para fck,est estatístico", sem fingir um fck,est.

A mudança degrada com segurança: a query do lote está em try/catch; se não houver lote, o laudo sai como antes.

## Arquivos
- supabase/functions/generate-laudo-ensaio-pdf/index.ts — redeployada via MCP (não passa pelo Netlify). Incluída aqui para versionar.

## Validação
Deploy limpo (v6, sha mudou). **Validação visual fica in-app** (gerar laudo de uma obra COM lote criado em /lotes → conferir a faixa de Aceitação e a observação; e de uma obra SEM lote → conferir o texto por-exemplar honesto).

## Pendente
Picker de lote no disparo do laudo (passar `lote_id`) — opcional. Demais v1.1: fôrmas→medição; RAC (NC).

## Build
check-source OK (sem mudança de front).
