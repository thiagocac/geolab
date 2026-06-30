# CHANGELOG v133 — Toggles da ficha de moldagem (dosagem do traço + contato/equipe)

Acompanha a reescrita da EF `generate-ficha-moldagem-pdf` (v21, ezbr cb457923). Dois novos campos no catálogo
**Campos da concretagem (etapa 1)**, que controlam blocos opcionais da FICHA (só a ficha; o laudo ignora):

- `ficha_contato_equipe` (**off**): mostra Contato, Equipe e Ref. no cabeçalho da ficha (em branco, manual).
- `ficha_dosagem` (**off**): adiciona a linha de dosagem detalhada (cimento, consumo, D.máx, a/c, areia,
  pedra, água, aditivo), **pré-preenchida a partir do traço** (`operational_materials`).

Ambos **desligados por padrão** — a ficha default fica enxuta. Aparecem automaticamente em
Config. de Campos › Concretagem (a aba itera o catálogo). Cumulativo sobre a v132 (numeração de CP manual).

CACHE_NAME=consultegeo-geolab-v133 · APP_VERSION=v133
