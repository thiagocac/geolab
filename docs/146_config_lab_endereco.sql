-- 146_config_lab_endereco (fiel ao vivo)
alter table public.config_lab
  add column if not exists endereco text, add column if not exists numero text,
  add column if not exists bairro text, add column if not exists cidade text,
  add column if not exists uf text, add column if not exists cep text;
-- Preenchidos em /preferencias (por tenant). Ao salvar, o front compõe config_lab.endereco_origem
-- (ponto de partida da rota de coleta, migration 145) e zera origem_lat/lng para re-geocodificar.
