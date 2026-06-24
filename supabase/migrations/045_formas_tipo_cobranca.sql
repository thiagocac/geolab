-- Fôrmas→medição: libera o tipo 'cobranca' em forma_movimentacoes (evento de cobrança).
-- computar_medicao JA soma quantidade where tipo='cobranca'; v_formas_saldo JA trata !=entrega como -quantidade.
-- Aplicado via MCP. Drop do CHECK antigo (tipo in entrega|coleta) + novo CHECK (entrega|coleta|cobranca).
do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid='public.forma_movimentacoes'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%tipo%';
  if c is not null then execute 'alter table public.forma_movimentacoes drop constraint '||quote_ident(c); end if;
end $$;
alter table public.forma_movimentacoes
  add constraint forma_movimentacoes_tipo_check check (tipo = any (array['entrega','coleta','cobranca']));
