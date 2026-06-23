# GEOLAB — SOURCE VERSION v4
Frontend: fundacao (v2) + Cadastros (v3) + Concretagem (v4).
CACHE_NAME: consultegeo-geolab-v4 · APP_VERSION: v4

## v4 — Concretagem
- lib/api/concretagem.ts: listConcretagens (join cliente/obra/traco), createConcretagem, listCaminhoes, addCaminhao (gera amostra + CPs do padrao de moldagem), invokeFicha (EF).
- ConcretagensPage (central + nova), ConcretagemDetalhePage (caminhoes + add + ficha).

## Backend (vivo via MCP): 19 migrations; EFs ficha + laudo.
## Proximo (v5): Rompimento (carga->MPa, agenda, aceitacao por exemplar).
