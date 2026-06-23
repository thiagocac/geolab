# Release v4 — Concretagem

Fluxo central do dominio: programacao -> caminhoes -> amostra/CPs -> ficha.

## Entregue
- Central de Concretagens (lista com cliente/obra/fornecedor/status) + Nova (form com FKs cliente/obra/traco).
- Detalhe: caminhoes; Adicionar caminhao cria material_receipts + amostras + corpos_prova (gerados pelo padrao de moldagem jsonb do traco; default 2x 28 dias com data_prevista_rompimento).
- Ficha PDF: invoca a EF generate-ficha-moldagem-pdf (fetch com JWT da sessao + anon key), baixa o PDF.

## Validacao no sandbox: check-source OK; 0 imports quebrados. tsc/vitest/vite no Netlify CI.
## Proximo: v5 (Rompimento).
