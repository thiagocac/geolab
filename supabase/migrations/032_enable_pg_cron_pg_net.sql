-- 032: habilita pg_cron (agendador) e pg_net (HTTP async) para os crons. Aplicada via MCP.
create extension if not exists pg_cron;
create extension if not exists pg_net;
