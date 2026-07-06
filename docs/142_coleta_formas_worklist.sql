-- 142_coleta_formas_worklist (fiel ao vivo)
alter table public.forma_movimentacoes add column if not exists concretagem_id uuid references public.concretagens(id);
create index if not exists idx_forma_mov_concretagem on public.forma_movimentacoes(concretagem_id) where concretagem_id is not null;
-- public.coleta_worklist(p_ate date default current_date, p_dias int default null) returns jsonb
--   Fôrmas a coletar derivadas da concretagem: previsto = coalesce(formas_previstas, nº CPs vivos);
--   coletado = soma das coletas com aquele concretagem_id; saldo = previsto − coletado (>0).
--   Agrupa por obra com endereço (client_works) e contato (client_contacts). SECURITY DEFINER +
--   is_tenant_member; EXECUTE só authenticated.
