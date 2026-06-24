# GEOLAB v43 — Motor de NC (Fase C): grafo de transições + anexos + CP atrasado→NC

## Backend (migration 042, JÁ aplicada via MCP em xbdvyvvxvzmcosnekmfv)
- **CP atrasado → NC T-10**: função `gerar_ncs_cp_atrasado()` (CP na idade de controle, não rompido, além de `data_prevista_rompimento + config_lab.cp_overdue_days`) + cron diário `concresoft-nc-cp-atrasado` (30 9, SQL direto, sem EF). Validado: 1 CP vencido → NC-…-T-10 (CLS-007).
- **Storage `anexos`**: policy `nc_anexos_rw` escopada por tenant (pasta raiz = tenant_id; exclui cliente via is_tenant_member) — para os anexos das ações.

## Frontend (vai pro GitHub)
- **Editor de grafo de transições** (Gestão → Config de NC): por classificação, chips de transição removíveis (×) + "Adicionar transição" (de/para entre as ações). Insert/reativa em `nc_action_transitions`; remove = `ativo=false`. Só admin (RLS is_tenant_admin).
- **Anexos nas ações** (Não-conformidades → detalhe): campo de arquivo na ação → upload ao bucket `anexos` (`{tenant}/{nc}/...`) gravando `campos_dinamicos.arquivo`; timeline mostra "Baixar anexo" via signed URL (5 min).
- Arquivos: src/lib/api/nc.ts (uploadAnexo/signedAnexo), src/lib/api/ncConfig.ts (addTransition/removeTransition), src/pages/concreto/NcPage.tsx, src/pages/gestao/NcConfigPage.tsx.
- public/sw.js + src/lib/telemetry/core.ts — bump **v43**.

## Passos
1. Subir o frontend no GitHub. Backend já aplicado.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v43` / APP_VERSION=`v43`.
3. Validar in-app: Config de NC → adicionar/remover transição numa classificação; numa NC, registrar ação com anexo e baixar.

## Pendente (Fase C restante)
RAC + generate-nc-report-pdf; autoconclusão por tolerância; e-mail de NC.

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
