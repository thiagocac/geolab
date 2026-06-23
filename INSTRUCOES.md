# Concresoft — Patch v33 (assets oficiais do brand kit Concresoft)

Sobre o v30. Acumula v31 (laudo v4) + v32 (rebrand de texto + EFs) + v33 (assets oficiais).

## v33 — brand kit Concresoft (oficial)
O kit Concresoft usa o MESMO sistema visual já aplicado (cores navy/roxo/magenta + gradiente, símbolo de 3 barras, fontes Mona Sans/JetBrains) — só muda o nome e os arquivos.
- **Trocados** `public/brand/geolab-*.svg` → `public/brand/concresoft-*.svg` (symbol/lockup/appicon/favicon oficiais, aria-label "Concresoft", lockup com wordmark "Concresoft").
- `public/favicon.svg` → favicon oficial Concresoft.
- `public/manifest.webmanifest` + `index.html` → refs de ícone → `concresoft-appicon.svg`.
- **REMOVER do repo** os antigos `public/brand/geolab-*.svg` (8 arquivos) — substituídos pelos concresoft-*.
- Bump CACHE_NAME/APP_VERSION = v33. Build verde.

## EFs (já deployadas via MCP)
laudo v5 (wordmark Concresoft) + send-notification v2 (e-mail Concresoft). Domínio lab.consultegeo.org mantido (P4).

## PENDENTE
P4 (você): domínio Concresoft + Resend. P5: slugs internos (package name, prefixo cache, comentários).
