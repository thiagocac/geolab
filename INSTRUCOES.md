# GEOLAB → Concresoft — Patch v97 (cumulativo sobre v93) — FIX DE BUILD
## Regenera database.types.ts (corrige o tsc quebrado dos patches v95/v96)

Bump: `CACHE_NAME consultegeo-geolab-v97` + `APP_VERSION v97`.

### O problema (por que o commit/build falhou)
A migration 070 adicionou as colunas `concretagens.numero_relatorio`/`relatorio_seq` e `client_works.sigla`
no banco vivo, **mas `src/lib/database.types.ts` não foi regenerado**. O `src/lib/api/concretagem.ts` usa o
cliente Supabase **tipado** (`const db = supabase;`) e faz `.select('… numero_relatorio …')` → o `tsc` falha
("coluna não existe nos tipos"). O **esbuild não checa tipos**, então os patches v95/v96 passavam no meu gate
local mas **quebravam no `tsc`** do Netlify (2 erros, ambos em `concretagem.ts`). `rompimento.ts` e
`importacao.ts` usam `db` como `any`, por isso não acusavam.

### A correção
- **`src/lib/database.types.ts` regenerado** do banco vivo (`xbdvyvvxvzmcosnekmfv`) via MCP — agora declara
  `numero_relatorio`, `relatorio_seq` (concretagens) e `sigla` (client_works) em Row/Insert/Update.
- Verificado com `tsc --strict` (probe positivo nas colunas novas = OK; controle negativo com coluna
  inexistente = erro TS2339, provando que o tsc valida de fato).

### Aplicar
1. `unzip -o consultegeo-geolab-source-patches-v97.zip` na raiz do repo.
2. `git add -A && git commit -m "v97: regenera database.types.ts (fix tsc do numero_relatorio)" && git push`.
3. Netlify builda verde (check-source → biome → tsc → vitest → vite).

### Conteúdo (cumulativo v94+v95+v96 + o fix)
17 arquivos: o **`src/lib/database.types.ts`** regenerado (o fix) + os 15 da v96 (rompimentos v94; numeração de
relatório v95; sigla da obra v96) + bump + `INSTRUCOES.md`. EF `generate-laudo-ensaio-pdf` (sync do repo; já LIVE).

### Lição (para o pipeline)
**Sempre regenerar `database.types.ts` quando uma migration adicionar/alterar colunas referenciadas pelo cliente
Supabase tipado.** O esbuild não pega isso — só o `tsc`. (Migrations seguem sendo aplicadas via MCP; o que faltava
era levar os tipos junto no patch.)
