-- 145_coleta_geocode_origem (fiel ao vivo)
alter table public.client_works add column if not exists lat double precision, add column if not exists lng double precision, add column if not exists geocoded_at timestamptz;
alter table public.config_lab add column if not exists endereco_origem text, add column if not exists origem_lat double precision, add column if not exists origem_lng double precision;
-- set_coleta_origem(p_endereco text): grava config_lab.endereco_origem e zera origem_lat/lng (re-geocodifica). writer.
-- reordenar_roteiro(p_id uuid, p_ordens jsonb=[{id,ordem}]): persiste a ordem otimizada dos itens. writer.
-- EXECUTE só authenticated. Geocodificação em runtime pela EF geocode-obras (Nominatim/OSM).
