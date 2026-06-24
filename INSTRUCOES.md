# GEOLAB v40 — Motor de NC (não-conformidades) — engine configurável

Re-derivado do GEOMAT. Engine completo: catálogos + workflow de ações configurável + gatilho automático.

## Backend (JÁ aplicado via MCP em xbdvyvvxvzmcosnekmfv)
- **migration 039** — tabela-cabeça `non_conformities` (estava ausente) + seed dos catálogos globais (8 classificações, 18 situações, 14 tipos) + `nc_action_templates.acao_projetista`.
- **migration 040** — `seed_nc_action_engine`/`seed_nc_rac_padrao` (6 ações × classificação + 8 transições + RAC padrão, semeados para o tenant), `abrir_nc_manual`, `registrar_acao_nc` (valida transição+permissão, conclui a NC), e o **gatilho** `create_nc_from_test_result` no `material_tests` (cria NC T-02 quando resultado < fck **na idade de controle**; T-08 alteração após aceite).
- Validado: ensaio 25<30 a 28d → NC T-02 automática; a 7d → não gera (idade de acompanhamento não reprova).

## Frontend (vai pro GitHub)
- src/lib/api/nc.ts (novo) + src/pages/concreto/NcPage.tsx (novo) — caixa de NC + detalhe/tratativa.
- src/App.tsx (rota /nao-conformidades), src/components/Layout.tsx (nav "Não-conformidades", Concreto).
- public/sw.js + src/lib/telemetry/core.ts — bump v40.

## Tela (Concreto → Não-conformidades)
- Lista filtrável por status/obra; abertura automática (gatilho) ou manual.
- Detalhe: timeline de ações + registrar próxima ação (só as transições permitidas pelo engine) + concluir. Nova NC manual.

## Passos
1. Subir o frontend no GitHub. Backend já aplicado.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v40` / APP_VERSION=`v40`.
3. Validar in-app: romper um CP abaixo do fck na idade de controle → a NC aparece em Não-conformidades; tratar registrando ações até concluir.

## Pendente (próximas fases)
- Fase C: telas de config (parâmetros de tolerância, editor de templates), anexos nas ações (campo 'arquivo'), RAC (relatório de ação corretiva), `generate-nc-report-pdf`.
- Outros gatilhos automáticos (slump, calibração, CP atrasado→NC) e e-mail de NC.

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
