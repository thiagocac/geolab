-- 131: apelido operacional do equipamento (base da gestao multi-prensa).
-- Aplicada via MCP em xbdvyvvxvzmcosnekmfv (02/07/2026). Registro para o repo.
-- Rotulo curto para distinguir prensas identicas no seletor de rompimento, na fila e no laudo
-- ("Prensa 1" vs "Prensa 2") quando marca_modelo/numero_serie nao bastam. Nullable; UI usa
-- coalesce(apelido, marca_modelo). Aditiva, sem DROP. RLS herdada da tabela.
alter table public.equipamentos add column if not exists apelido text;
