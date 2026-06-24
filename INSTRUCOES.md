# GEOLAB v49 — Financeiro: faturamento (emissão / baixa) sobre a medição

O papel **`financeiro`** já existia (em `is_tenant_writer`, no nav e na Operação). Faltava o faturamento — agora a medição fechada vira fatura.

## Backend (migration 047, JÁ aplicada via MCP)
- Tabela **`faturas`** (medicao_id, client, numero `FAT-AAAA-NNNNNN`, valor, status `emitida|paga|cancelada`, emissão, vencimento, pagamento, forma) + RLS (leitura = membro do tenant; escrita = `is_tenant_writer`, que inclui financeiro).
- RPC **`emitir_fatura(medicao_id, vencimento)`** — cria a fatura a partir de uma medição fechada (valor = total da medição; 1 fatura ativa por medição; número sequencial). Baixa/cancelamento por update. Validado (atômico, sessão simulada): FAT-2026-000001, valor 1.234,56, emitida, vencimento 10/07.

## Frontend (vai pro GitHub)
- src/lib/api/faturas.ts (novo) + src/pages/gestao/FaturasPage.tsx (novo) — lista/filtros, cards "a receber"/"pago", **Emitir** (de uma medição fechada sem fatura), **Baixar** (data + forma de pagamento), **Cancelar**.
- src/App.tsx (rota /faturas), src/components/Layout.tsx (nav "Faturas", Gestão, roles admin/admin_consulte/**financeiro**).
- public/sw.js + src/lib/telemetry/core.ts — bump **v49**.

## Fluxo
Gestão → Medição (fechar uma medição) → **Faturas** → Emitir fatura (escolher a medição + vencimento) → quando pago, **Baixar** (data + forma). O usuário `financeiro` (atribuído em Operação → Usuários) acessa a tela.

## Passos
1. Subir o frontend no GitHub. Backend já aplicado.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v49` / APP_VERSION=`v49`.

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
