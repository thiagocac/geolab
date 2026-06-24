# GEOLAB v42 — Motor de NC (Fase C): telas de configuração

Frontend-only (sem mudança de banco; usa nc_parameters / nc_action_templates / nc_action_transitions já existentes).

## O que entra
Tela nova **Gestão → Config de NC** (`/gestao/nc-config`), com duas seções:

- **Tolerâncias** (`nc_parameters`) — editor dos parâmetros lidos pelos gatilhos: **validade do concreto (h)** (em uso hoje, gatilho T-01), tolerância de slump/flow, % de conclusão automática, % de ação imediata, tolerância de lançamento. Grava uma linha "geral" por laboratório. Edição por admin/gestor (RLS is_tenant_writer).
- **Fluxo de tratativa** (`nc_action_templates` + `nc_action_transitions`) — por classificação: lista as ações do workflow (nome, situação destino, conclui, ativo, mensagem) e as transições permitidas. Edição leve dos campos seguros (nome, mensagem, ativo, múltipla aplicação) restrita ao **admin** (RLS is_tenant_admin).

## Arquivos (frontend → GitHub)
- src/lib/api/ncConfig.ts (novo), src/pages/gestao/NcConfigPage.tsx (novo)
- src/App.tsx (rota /gestao/nc-config), src/components/Layout.tsx (nav "Config de NC", Gestão)
- public/sw.js + src/lib/telemetry/core.ts — bump **v42** (v41 foi backend-only, sem cache).

## Passos
1. Subir o frontend no GitHub. Sem backend a aplicar.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v42` / APP_VERSION=`v42`.
3. Validar in-app: Gestão → Config de NC → setar "validade do concreto" → conferir que o gatilho T-01 passa a valer; abrir uma classificação e editar a mensagem de uma ação.

## Pendente (Fase C restante)
Editor de grafo de transições (rotear o fluxo); RAC + generate-nc-report-pdf; anexos nas ações; CP atrasado→NC (cron); autoconclusão por tolerância; e-mail de NC.

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
