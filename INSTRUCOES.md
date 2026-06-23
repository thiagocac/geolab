# GEOLAB — Patch v26 (Estrutura/Peças da obra)

Último gap de peso fechado: gestão da **estrutura** de uma obra (opcional, para obras com
`estrutura_habilitada`), em 3 níveis — **Grupos → Tipos → Peças** (tabelas `unit_groups`/
`unit_types`/`units`, já existentes desde a migration 008).

## Sem backend novo (RLS por tenant; work_id escopa por obra)

| Arquivo | Mudança |
|---|---|
| `src/lib/api/estrutura.ts` | **NOVO** — listObrasEstrutura, listGrupos/Tipos/Pecas, addEstrutura, delEstrutura |
| `src/pages/cadastros/EstruturaPage.tsx` | **NOVO** — seletor de obra + 3 seções (lista + adicionar/remover por nível) |
| `src/App.tsx` | rota `/estrutura` |
| `src/components/Layout.tsx` | nav "Estrutura" (Layers) na seção Cadastros |
| `public/sw.js` · `core.ts` | `v26` |

## Modelo
- **Grupos**: ex. Torre A, Bloco 1 (codigo, nome, tipo de edificação).
- **Tipos**: ex. Pilar P1, Laje L2 — etapa, volume de projeto e **traço** (operational_material),
  de onde o fck do tipo deriva.
- **Peças (units)**: a peça concreta, ligando grupo + tipo, com volume.

## Nota
A página só lista obras com **estrutura habilitada** (ligue em Cadastros › Obras ou na Nova obra).
Consumo na concretagem (escolher a peça em vez de digitar o local) é o próximo passo de wiring;
hoje a concretagem usa `local_texto` livre. Build completo verde. Push em `main`.
