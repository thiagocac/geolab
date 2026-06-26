# INSTRUÇÕES — Release v84 (revisão tipográfica do laudo + toggle de aceitação)

## Vai pro GitHub (este zip de patches → Netlify CI builda e publica)
Suba mantendo os caminhos:
- src/lib/concreto/camposEnsaioLaudo.ts  → novo toggle "Bloco de aceitação" em CAMPOS_LAUDO
- public/sw.js                           → CACHE_NAME consultegeo-geolab-v84
- src/lib/telemetry/core.ts              → APP_VERSION v84
- SOURCE_VERSION.md                      → changelog v84
- supabase/functions/generate-laudo-ensaio-pdf/index.ts → PARIDADE (já LIVE via MCP; commit p/ repo ≡ vivo)

> Base: v83. Se o GitHub estiver atrás do v83, suba antes o source-completo do v83 (ou o v84 completo).

## Backend — JÁ APLICADO via MCP (independe deste push)
EF generate-laudo-ensaio-pdf  v14→v15  sha b247c9ac → 3242a328 (ACTIVE, verify_jwt=true).
acentuação PT-BR completa · m³/kg/m³ · °C · Nº · ± · × · barra de aceitação em 2 linhas (corrige a
sobreposição "condição A / fck,est") · horários HH:MM · san() endurecido · novo toggle `aceitacao` (default ON).

## Toggles (config por laboratório em /gestao/controle-laudo ▸ Seções do laudo (PDF))
- "Bloco Recebimento dos caminhões" (recebimento) — já existia; desligar remove os dados de caminhões.
- "Bloco de aceitação" (aceitacao) — NOVO; desligar remove a faixa fck,est × fck + veredito.
Persistência: config_lab.laudo_campos (jsonb). Sem migration / sem mudança de RLS.

## Gate
check-source OK (rodado aqui). biome/tsc/vitest/vite no Netlify CI. Produção VITE_DEMO_MODE=false.
