-- Lookup fiscal (CEP) na obra precisa de onde gravar. Aditivo/idempotente.
alter table public.client_works add column if not exists cep text;
alter table public.client_works add column if not exists bairro text;
