# GEOLAB→Concresoft — Patch v32 (rebrand de texto P1, sobre o v30)

Parte do v30 (remoto). Inclui o que ainda não foi pro GitHub: **v31** (laudo v4 + migration 031) **e v32** (rebrand de texto Concresoft).

## v31 (laudo dinâmico v4) — backend já aplicado via MCP
- Migration 031 (config_lab +local_ensaio/art/gerente/crea_gq; operational_materials.componentes).
- EF generate-laudo-ensaio-pdf v4 (5 toggles + paridade v4). Telas Preferências/Traços atualizadas.

## v32 (Concresoft P1 — texto/nome)
Substituído todo texto visível **Consulte GEO + GEOLAB + GEOMAT → Concresoft**, mantendo o sistema visual do brand kit (símbolo de barras, paleta navy/magenta/roxo + gradiente, fontes Mona Sans/JetBrains):
- index.html title, manifest (name/short_name), Layout (sidebar + rodapé), LoginScreen (nome + rodapé), Dashboard, ValidarPage, OperacaoPage, MateriaisPage (remove GEOMAT). aria-labels e lockups SVG → Concresoft.
- Bump CACHE_NAME/APP_VERSION = v32. Build completo verde.

## PENDENTE do rebrand (próximas fases)
- **P3** — EFs: laudo ainda desenha o wordmark "Consulte GEO" e usa o domínio `lab.consultegeo.org` (laudo/ficha); send-notification (subject/wordmark/remetente). Precisam de redeploy.
- **P4 (você)** — domínio novo (DNS+Netlify) + Resend (domínio + RESEND_FROM). Sem isso, os hardcodes de domínio ficam.
- **P5** — internos (package name, prefixo de cache, comentários) — opcional.

## P3 — EFs rebrandeadas (deployadas via MCP)
- generate-laudo-ensaio-pdf v5 (sha c9da8996): wordmark "Consulte GEO" -> "Concresoft" (caixa C + Concre/soft).
- send-notification v2 (sha 51eed16d): subject [Concresoft], wordmark do e-mail (Controle Tecnológico / Concresoft), textos "na Concresoft".
- Domínio lab.consultegeo.org MANTIDO no laudo/ficha (QR aponta pro app vivo) — troca no P4 quando houver domínio Concresoft.
