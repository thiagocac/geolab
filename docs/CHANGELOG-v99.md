# CHANGELOG — v99

## Melhorias de front na Observabilidade (telemetria)

**Escopo:** somente frontend. **Nenhuma** migration, Edge Function ou alteração de banco.
Toda a leitura usa colunas/views que **já existem** em produção (verificado por introspecção via MCP
read-only antes de codar). Build verde ponta-a-ponta: `check-source · biome · tsc · vitest 18/18 · vite`.

### Arquivo alterado
- `src/pages/gestao/ObservabilidadePage.tsx` — reescrita incremental (mantém todas as queries/seções
  anteriores; nada removido em termos de dado exibido).

### Bumps
- `src/lib/telemetry/core.ts` — `APP_VERSION` `v98 → v99` (novo bucket de release-health no próximo deploy).
- `public/sw.js` — `CACHE_NAME` `consultegeo-geolab-v98 → v99`.

---

## O que mudou na tela `/observabilidade`

1. **Banner de saúde (topo).** Tira de status verde/âmbar/vermelho computada no cliente a partir de:
   críticos abertos, **críticos não notificados**, runners de telemetria atrasados e avisos abertos.
   - Vermelho: há crítico aberto **ou** runner de alarme/notify atrasado.
   - Âmbar: só avisos abertos.
   - Verde: nada aberto e todos os runners em dia.

2. **Coluna “Notificação” nos incidentes.** Surfacing do `telemetry_alert.notified_at` (garantia
   once-per-incident introduzida na migration **076**, `telemetry_notify_pending_alerts()`):
   - `notificado · há Xmin` (verde) quando o e-mail do incidente já saiu (tooltip com timestamp BR);
   - **`não notificado`** (âmbar) quando o alerta é **crítico** e ainda não foi notificado — sinal direto
     de que o e-mail não saiu;
   - `—` para avisos (por design, nem todo aviso gera e-mail).

3. **Card “Runners de alarme & notificação”.** Separa o **plano de controle** da telemetria dos demais
   jobs. Lista, com pílula de frescor e idade da última execução, os runners:
   `telemetry-alarm`, `telemetry-pg-alarm`, `telemetry-email-alarm`, `telemetry-release-alarm`,
   `telemetry-ops-alarm`, `telemetry-notify`.
   - É o payoff operacional do **heartbeat-decouple (077)**: um runner travado fica óbvio aqui, porque é
     ele que faz alertas dispararem / e-mails saírem. Classificação por regex de `job_name`
     (`/^telemetry-(alarm|pg-alarm|email-alarm|release-alarm|ops-alarm|notify)$/`), data-driven.
   - O antigo card de crons vira **“Outros jobs agendados”** (rollup, prune, backups, canário).

4. **Chip de família por `kind`.** Cada incidente mostra a família do sinal em vez do `kind` cru
   (o `kind` vai no tooltip): **Frontend** (web_vital/error_rate/frontend_health), **Release**
   (release_health/crash_free), **E-mail** (email_health), **Ops** (ops_health), **Agenda**
   (cron/schedule_health), **Banco** (`pg_*`), **Edge Fn** (`ef_*`). Torna visível o design de
   **namespaces disjuntos** entre os runners SQL e o runner EF (evita dupla-notificação).

5. **KPIs com cor + novo KPI.** Os cartões agora coloram por estado (vermelho/âmbar/verde) e há um novo
   **“Críticos não notificados”** — o número mais acionável da tela (críticos cujo e-mail não saiu).

6. **Estado “ao vivo” + botão “Atualizar”.** Indicador pulsante com `atualizado há Xs · auto 60s`
   (derivado do `dataUpdatedAt` das queries + ticker de 1s) e um botão que faz `refetch` de tudo.
   O botão “Rodar alarme agora” passou a atualizar **todas** as seções ao terminar (antes só MTTR/incidentes/crons).

7. **Barra inline de crash-free.** Mini-barra proporcional ao lado do percentual por versão (vermelha < 95%).

---

## Notas

- A janela de auto-refresh segue **60s** (`REFRESH_MS`). Auto-refetch do TanStack Query inalterado.
- O DS é o mesmo: `PageHeader/Card/CardHeader/State` + classes `card/table/kicker` + Tailwind. Os “pills”
  continuam sendo `span` Tailwind (não acoplam ao enum de tons do `Badge`).
- Mantida a observação histórica do cabeçalho do arquivo sobre regenerar `database.types.ts` — porém o
  `tsc --noEmit` do projeto está **verde** (0 erros) com as tabelas/views de telemetria já tipadas.
- **Sem relação** com a colisão de dedupe `cron-watchdog` × scans (074/072) registrada na v98 — aquilo
  é backend e segue pendente de decisão; esta entrega não a altera.
