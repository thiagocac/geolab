-- 055_evento_laudo_cliente.sql — Melhoria 3.1 (registrar o event_type do envio ao cliente). Alvo: GEOLAB.
-- NUMERAÇÃO: 055, após 054. O vivo versiona por timestamp; o nº é só ordem do repo.
-- NÃO aplicado por mim — aplicar via MCP apply_migration.
--
-- Não há FK de notification_dispatch_log.event_type -> notification_event_types.key (verificado no vivo),
-- então a EF enviar-laudo-cliente funciona sem isto; registrar o evento mantém o catálogo/painel coerentes.
-- Aditivo e idempotente.

INSERT INTO public.notification_event_types (key, codigo, categoria, severidade, descricao, default_channel, is_system, digest, active)
VALUES ('laudo_disponivel_cliente', 'LAU-CLI', 'laudo', 'info', 'Laudo emitido enviado ao cliente (e-mail com PDF anexo).', 'email', false, false, true)
ON CONFLICT (key) DO NOTHING;

-- FIM 055. (Sem template: a EF monta assunto/HTML inline. Se quiser editar o texto pelo app, crie depois
-- uma linha em notification_templates para event_type='laudo_disponivel_cliente'.)
