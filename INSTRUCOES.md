# GEOLAB — Patch v31 (laudo dinâmico: ligar toggles + paridade v4 + telas de cadastro)

Parte do v30 (brand kit). Backend (migration 031 + laudo EF v4) já aplicado no banco vivo via MCP.

## Backend já aplicado
- **Migration 031** — config_lab (+local_ensaio, art_numero, gerente_qualidade, crea_gq) + operational_materials.componentes (jsonb).
- **EF generate-laudo-ensaio-pdf v4** (sha 0778a594...) — 5 toggles antes mortos LIGADOS (amostragem c/ condição A/B; contato=Solicitante; local_ensaio/incerteza; componentes) + paridade v4 (capeamento "Bases"; ART; 2ª assinatura Gerente da Qualidade; legenda de normas).

## Frontend (este patch)
- **Preferências** (config_lab): + Local de ensaios, ART do RT, Gerente da Qualidade, CREA do GQ.
- **Traços** (operational_materials.componentes): sub-bloco Composição — marca/procedência (cimento/brita/areia/aditivo + água).
- **Rompimentos**: já capturava capeamento + prensa (ensaio_campos) — sem mudança necessária.
- Bump CACHE_NAME/APP_VERSION = v31.

## Validação
Build completo (check-source+tsc+vitest+vite) verde. Push em main → Netlify.
Gerar laudo com todos os toggles ligados e comparar com MODELO-Laudo-Resistencia-Compressao-v4.pdf.
