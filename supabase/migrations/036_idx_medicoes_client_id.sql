-- Indice de cobertura para o FK medicoes.client_id (fecha o unico WARN de FK sem indice).
create index if not exists idx_medicoes_client_id on public.medicoes (client_id) where deleted_at is null;
