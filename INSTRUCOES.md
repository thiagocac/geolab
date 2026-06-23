# GEOLAB — Patch v27 (wiring da peça na concretagem)

Fecha o ciclo da estrutura: na Nova concretagem, se a obra tem peças cadastradas
(Estrutura), aparece um seletor **Peça (estrutura)**. Escolher a peça:
- grava o vínculo estruturado em `concretagens.unit_id`, e
- popula `local_texto` com o nome da peça (que o laudo/ficha já imprimem).
Sem estrutura, segue digitando o local livremente.

## Backend já aplicado (via MCP)
- **Migration `026_concretagem_unit_link`** — `concretagens.unit_id uuid` (FK → units,
  nullable) + índice. Aditivo.

## Frontend
| Arquivo | Mudança |
|---|---|
| `src/lib/api/estrutura.ts` | **+ `listPecasObra`** (peças ativas da obra, label amigável) |
| `src/pages/concreto/ConcretagensPage.tsx` | seletor de peça (aparece se a obra tem peças) → `unit_id` + `local_texto`; reset de `unit_id` ao trocar de obra |
| `public/sw.js` · `core.ts` · `Layout.tsx` | `v27` |

Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
