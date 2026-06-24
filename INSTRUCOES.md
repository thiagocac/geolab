# GEOLAB v44 — Motor de NC (Fase C final): autoconclusão por tolerância + e-mail de NC

## Backend (JÁ aplicado/deployado via MCP)
- **migration 043** — autoconclusão por tolerância: template automático (CLS-002, `acao_automatica`, permissão 'sistema') + trigger `nc_autoconclude_tolerancia` (AFTER INSERT em non_conformities). Para NC automática T-02: pct = resultado/fck; se ≥ `conclusao_auto_pct` conclui automaticamente (Liberada com Ressalvas), senão se ≥ `acao_imediata_pct` rebaixa severidade p/ média. Lê `nc_parameters` (config na tela de Config de NC). **Dormente até o lab configurar os %.** Validado: 28/30 (93% ≥ 90) → concluída; 20/30 (67%) → aberta/alta.
- **EF cron-nc-digest** (nova, verify_jwt=false, sha 51e398f8) + **migration 044** (cron `concresoft-nc-digest`, 0 11) — digest diário das NCs abertas nas últimas 24h por tenant → admins/gestores via send-notification. **Armado, ocioso até G1** (CRON_SECRET no vault) e H3 (sair do dry-run), como os demais crons/e-mails.

## Frontend (vai pro GitHub)
- src/lib/api/nc.ts — esconde o template automático (`permissao_requerida='sistema'`) do seletor manual de ações.
- public/sw.js + src/lib/telemetry/core.ts — bump **v44**.

## Passos
1. Subir o frontend no GitHub. Backend já aplicado/deployado.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v44` / APP_VERSION=`v44`.
3. Para ligar a autoconclusão: Config de NC → setar "Conclusão automática (% do fck)" (ex.: 90). E-mail de NC dispara quando o CRON_SECRET estiver no vault e o dispatch sair do dry-run.

## Fase C — COMPLETA exceto RAC
Falta só: **RAC + generate-nc-report-pdf** (relatório de ação corretiva auditável). Demais pendências v1.1: laudo↔lote; fôrmas→medição.

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
