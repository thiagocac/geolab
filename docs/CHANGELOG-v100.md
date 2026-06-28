# CHANGELOG — v100

## Observabilidade: incidentes investigáveis + sparkline por Edge Function

**Escopo:** somente frontend. **Nenhuma** migration, Edge Function ou alteração de banco. Toda leitura usa
colunas/views que **já existem** em produção (conferido por introspecção MCP read-only antes de codar:
`telemetry_alert.resolved_at`/`notified_at`, `v_ef_metrics_hourly` com linhas horárias na janela de 24h).
Build verde ponta-a-ponta: `check-source · biome · tsc 0 erros · vitest 18/18 · vite`.

### Arquivo alterado
- `src/pages/gestao/ObservabilidadePage.tsx` — reescrita incremental (mantém todas as seções da v99).

### Bumps
- `src/lib/telemetry/core.ts` — `APP_VERSION` `v99 → v100`.
- `public/sw.js` — `CACHE_NAME` `consultegeo-geolab-v99 → v100`.

---

## O que mudou na tela `/observabilidade`

1. **Incidentes investigáveis (antes a lista era estática, só abertos).** A seção de incidentes ganhou
   uma barra de controle:
   - **Alternância `Abertos | Resolvidos (7d)`.** A aba *Resolvidos* consulta `telemetry_alert` com
     `status='resolved'` e `resolved_at` nos últimos 7 dias (limite 100, ordenado por `resolved_at` desc).
     A query só dispara quando a aba é aberta (`enabled` do TanStack) — zero custo enquanto não usada.
   - **Coluna “Durou” (tempo até resolver / TTR)** na aba Resolvidos: `resolved_at − first_seen_at`,
     formatado humano (min/h/d). Dá leitura imediata de quão demorado foi cada incidente — complementa
     o KPI de MTTR médio com o detalhe item-a-item.
   - **Filtros client-side**: gravidade (todas/crítico/aviso), **família** (dropdown populado a partir
     dos dados presentes) e **“só não notificados”** (aba Abertos) — combine `crítico` + `só não
     notificados` para isolar exatamente os incidentes cujo e-mail não saiu.
   - **Contador “X de Y”** mostrando quantos passaram pelo filtro.
   - Estados vazios distintos: “Nenhum incidente aberto ✓”, “Nenhum resolvido nos últimos 7 dias”,
     “Nenhum incidente com os filtros atuais”.

2. **Sparkline 24h por Edge Function.** A query de EF passou a trazer a **série horária bruta** das
   últimas 24h (em vez de colapsar no servidor); a tela deriva, por função, a hora mais recente (para os
   números de chamadas/5xx/p95, semântica inalterada) **e** uma mini-tendência de **chamadas por hora**
   exibida numa nova coluna “24h”. Dá contexto de tráfego aos números pontuais (um p95 alto com tráfego
   subindo conta uma história diferente de um pico isolado). Sem query extra — é a mesma fonte
   (`v_ef_metrics_hourly`), agrupada no cliente.

---

## Notas

- Refatoração da derivação de EF: agrupamento por `fn_name`, “último” = última hora da série; ordenação
  por p95 desc mantida para gráfico e tabela. Removido o helper local `latestPerKey` (não mais usado).
- Banner de saúde e KPIs continuam computados sobre os **abertos** — alternar para *Resolvidos* não muda
  o topo da página.
- `refetchAll` (botão Atualizar e pós “Rodar alarme agora”) agora também atualiza a aba de resolvidos.
- DS inalterado: `select`/`checkbox`/segmented são Tailwind puro; pills seguem `span` Tailwind.
- **Sem relação** com a pendência de dedupe `cron-watchdog` × scans (074/072) da v98 — backend, segue
  em aberto para decisão.
