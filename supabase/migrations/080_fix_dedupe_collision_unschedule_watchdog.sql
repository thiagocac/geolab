-- 080 — Correção da colisão de dedupe (cp_atrasado / calibracao_vencendo)
-- ===========================================================================
-- APLICADA EM PRODUÇÃO via MCP em 2026-06-27 (este arquivo é a reconstrução fiel).
--
-- CAUSA
--   Dois caminhos emitiam os MESMOS eventos com dedupe_keys divergentes, então o
--   dedupe por notification_dispatch_log não suprimia o segundo envio:
--
--   cp_atrasado
--     • LEGADO  cron-watchdog (job 09:00) varre corpos_prova (situacao='pendente',
--               vencidos) -> dedupe 'cp_atrasado:corpo_prova:<cp.id>'
--     • MODERNO gerar_ncs_cp_atrasado (09:30) cria NC T-10 do CP vencido ->
--               notify_scan_cp_atrasado (10:00) -> dedupe 'cp_atrasado:<nc.id>'
--   calibracao_vencendo
--     • LEGADO  cron-watchdog (09:00) varre equipamentos (<= hoje+30, INCL. vencidas)
--               -> dedupe 'calibracao_vencendo:equipamento:<id>:<validade>'
--     • MODERNO notify_scan_calibracao (12:00) varre equipamentos (hoje..hoje+30) ->
--               dedupe 'calibracao_vencendo:<id>:<validade>'
--
-- EVIDÊNCIA (2026-06-27, dispatch_enabled=true / dry_run=false — envio VIVO):
--   notification_dispatch_log registrou no mesmo dia, para cp_atrasado, as duas
--   famílias de chave convivendo ('cp_atrasado:<uuid_nc>' e
--   'cp_atrasado:corpo_prova:<uuid_cp>') => 2 e-mails por CP vencido.
--
-- DECISÃO
--   O cron-watchdog é legado e hoje está inteiramente coberto pelos emissores SQL
--   modernos (settings-aware, via notify_event_dispatch -> outbox). Desagendamos o
--   watchdog. Efeitos de ESCOPO assumidos (ver CHANGELOG):
--     • cp_atrasado passa a cobrir só CPs na idade de controle 28D (via NC T-10).
--     • calibracao_vencendo passa a ser só pré-vencimento (perde alerta de já vencidas).
--
-- REVERSÍVEL: reagendar o job restaura o comportamento anterior. Ex.:
--   select cron.schedule('cron-watchdog','0 9 * * *', $$ ... net.http_post(...) ... $$);
--   (A Edge Function cron-watchdog permanece IMPLANTADA, porém dormente: exige
--    x-cron-secret e, sem job agendado, não dispara.)
-- ===========================================================================

do $$
declare j bigint;
begin
  for j in select jobid from cron.job where command like '%/functions/v1/cron-watchdog%' loop
    perform cron.unschedule(j);
  end loop;
end $$;
