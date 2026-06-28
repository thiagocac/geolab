# HOTFIX — Colisão de dedupe (cp_atrasado / calibracao_vencendo)

**Data:** 2026-06-27 · **Tipo:** correção de backend (cron) · **Aplicada em produção via MCP.**
**Frontend inalterado** (sem bump de APP_VERSION/cache; o bundle não muda).

## Sintoma
Com o envio de e-mail VIVO (`dispatch_enabled=true`, `dry_run=false`), cada **CP vencido**
gerava **dois** e-mails `cp_atrasado` por dia. (O par de `calibracao_vencendo` tinha o mesmo
defeito no código, mas estava dormente por não haver equipamento na janela.)

## Causa raiz
Dois caminhos emitiam os mesmos eventos com `dedupe_key` divergentes — logo o dedupe por
`notification_dispatch_log` não suprimia o segundo:

| Evento | Legado (cron-watchdog) | Moderno (SQL scans) |
|---|---|---|
| `cp_atrasado` | varre `corpos_prova` pendentes vencidos → `cp_atrasado:corpo_prova:<cp.id>` (09:00) | `gerar_ncs_cp_atrasado` cria NC T-10 (09:30) → `notify_scan_cp_atrasado` → `cp_atrasado:<nc.id>` (10:00) |
| `calibracao_vencendo` | varre `equipamentos` ≤ hoje+30 (incl. vencidas) → `...:equipamento:<id>:<validade>` (09:00) | `notify_scan_calibracao` hoje..hoje+30 → `...:<id>:<validade>` (12:00) |

**Evidência (2026-06-27):** o `notification_dispatch_log` mostrou no mesmo dia, para `cp_atrasado`,
as duas famílias de chave convivendo (`cp_atrasado:<uuid_nc>` e `cp_atrasado:corpo_prova:<uuid_cp>`),
os mesmos ~6 CPs notificados 2×.

## Correção (migration 080)
Desagendado o `cron-watchdog` (job pg_cron das 09:00). Ele é **legado** e hoje está inteiramente
coberto pelos emissores SQL modernos (que ainda respeitam `notification_dispatch_settings` e passam
por `notify_event_dispatch` → `notify_event_outbox`). **Reversível**: reagendar o job restaura.
A Edge Function `cron-watchdog` permanece **implantada, porém dormente** (exige `x-cron-secret`;
sem job agendado, não dispara).

Verificação pós-aplicação: `0` jobs de watchdog restantes; emissores modernos seguem agendados
(`gerar_ncs` 09:30 · `notify_scan_cp_atrasado` 10:00 · `notify_scan_calibracao` 12:00).

## Efeitos de ESCOPO assumidos (decidir se quer reverter algum)
1. **`cp_atrasado`** agora cobre só CPs na **idade de controle 28D** (via NC T-10), porque
   `gerar_ncs_cp_atrasado` filtra `idade_dias = idade_controle_default`. O watchdog pegava CPs
   `pendente` vencidos de **qualquer** idade. (Provável melhoria de sinal — 28D é o controle de
   aceitação NBR 5739 — mas é uma mudança de cobertura.)
2. **`calibracao_vencendo`** agora é só **pré-vencimento** (hoje..hoje+30). Perde-se o alerta de
   equipamentos com calibração **já vencida** (o watchdog os incluía).
   → *Follow-up opcional recomendado:* ampliar `notify_scan_calibracao` para incluir vencidas, com
     texto ajustado ("vencida há N dias" vs "vence em N dias"), preservando a `dedupe_key`.

## Não-ações (deliberadas)
- A EF `cron-watchdog` não foi deletada (só desagendada) — reversível. Posso removê-la se quiser.
- `gerar_ncs_cp_atrasado` (semântica T-10/28D, intencional) não foi tocada.
- Os e-mails duplicados já enviados não têm como ser "desenviados"; daqui pra frente não duplica.
