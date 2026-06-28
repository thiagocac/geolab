# CHANGELOG — v101

## Release de backend: correção da colisão de dedupe + cobertura de calibração vencida

Release **rotulado** que costura as duas mudanças de backend aplicadas em produção via MCP em
2026-06-27. **Frontend = v100 inalterado** (observabilidade); o bump de `APP_VERSION`/cache para v101
é só para marcar o release (o bundle de FE não muda).

### Migrations (ambas JÁ aplicadas em produção; aqui reconstruídas no repo)
- **080 — `fix_dedupe_collision_unschedule_watchdog`**
  Desagenda o `cron-watchdog` (legado), que duplicava `cp_atrasado` e `calibracao_vencendo` com
  `dedupe_key` divergentes dos emissores SQL modernos. Era um **incidente vivo** (envio com
  `dispatch_enabled=true`/`dry_run=false`): em 27/06 o `notification_dispatch_log` mostrou os mesmos
  CPs notificados 2× (`cp_atrasado:<uuid_nc>` do scan + `cp_atrasado:corpo_prova:<uuid_cp>` do
  watchdog). Reversível (reagendar). A EF `cron-watchdog` foi **neutralizada** (v8, no-op).
  Detalhe completo em `docs/CHANGELOG-hotfix-dedupe-watchdog.md`.
- **081 — `calibracao_scan_inclui_vencidas`**
  `notify_scan_calibracao` passa a cobrir também calibrações **já vencidas** (remove o piso
  `validade >= hoje`; varre `validade <= hoje+p_days`), fechando o gap deixado pela 080. `dedupe_key`
  inalterada (1 notificação por equipamento×validade); texto adaptado ("venceu em … (ha N dias)" vs
  "vence em … (em N dias)"). Verificado: 0 equipamentos vencidos no momento → sem rajada.

### Efeito líquido na notificação
- `cp_atrasado`: 1 e-mail por CP vencido (via NC T-10 / 28D), em vez de 2.
- `calibracao_vencendo`: 1 e-mail por equipamento, cobrindo a vencer **e** já vencidas (antes o
  watchdog duplicava as a vencer e o scan ignorava as vencidas).

### Sem mudança de frontend
Nenhuma alteração de UI/bundle nesta release. `tsc`/`vitest` permanecem como no v100.

> Pendência opcional remanescente: remover de vez a EF `cron-watchdog` dormente (hoje só desagendada)
> — destrutivo, aguardando confirmação explícita.
