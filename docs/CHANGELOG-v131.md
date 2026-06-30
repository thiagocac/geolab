# CHANGELOG v131 — Numeração do laboratório como toggle + label do filtro de busca

## Frontend
- **Config. de Campos › Ensaio:** novo campo **Numeração do laboratório (por CP)** (`numeracao_lab`), **ligado por padrão**.
  Desligado, o botão **"+ numeração lab"** some de cada CP na tela de Rompimentos (a numeração do sistema continua valendo).
  A aba Ensaio já itera o catálogo, então o toggle aparece automaticamente e funciona dinamicamente.
- **Rompimentos:** o label do filtro de busca, antes **"Nota fiscal"**, agora é **"Buscar"** — coerente com o que o campo
  aceita (Nº relatório, NF, código ou numeração). As colunas "Nota fiscal" da tabela/exportação permanecem.

CACHE_NAME=consultegeo-geolab-v131 · APP_VERSION=v131
