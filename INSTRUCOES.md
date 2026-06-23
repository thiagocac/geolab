# GEOLAB — Patch v22 (validação pública de laudo + numeração da concretagem)

Fecha dois gaps de v1: o QR do laudo agora leva a uma página real, e a concretagem
ganha numeração automática.

## Backend já aplicado (via MCP)
- **Migration `023_concretagem_numbering`** — trigger `set_concretagem_codigo` gera
  `CONC-AAAA-NNNNNN` por tenant/ano (BEFORE INSERT, se `codigo` vier vazio) + índice
  único `(tenant_id, codigo)`. Concretagens novas saem numeradas.
- **EF `validar-laudo`** (v1, `verify_jwt=false`, pública) — recebe o código do QR
  (`LAU-<codigo da concretagem>`), devolve só info de autenticidade (número, status,
  data, lab, RT, revisão). Service-role; não expõe dado sensível.

## Frontend
| Arquivo | Mudança |
|---|---|
| `src/pages/ValidarPage.tsx` | **NOVO** — página pública de validação (sem login, sem Layout) |
| `src/lib/api/validar.ts` | **NOVO** — chama a EF só com a anon key |
| `src/App.tsx` | rota `/validar/:codigo` **fora do gate de auth** (detecta o path antes de exigir login) |
| `public/sw.js` · `core.ts` · `Layout.tsx` | `v22` |

## Fluxo
O laudo já imprime o QR para `lab.consultegeo.org/validar/LAU-<codigo>`. Agora esse link
abre a página pública, que consulta a EF e mostra se o laudo é autêntico/emitido.

Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
