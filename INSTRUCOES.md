# GEOLAB → Concresoft — Patch v96 (cumulativo sobre v93)
## Sigla da obra (auto 4 letras, editável) + Número de relatório por obra+ano + revisão de Resultados

Bump: `CACHE_NAME consultegeo-geolab-v96` + `APP_VERSION v96` (juntos).
Patch **cumulativo** desde v93: inclui revisão da tela de Resultados (v94), numeração de relatório (v95) e a sigla da obra (v96).

### Aplicar (sobe no GitHub → Netlify CI)
1. `unzip -o consultegeo-geolab-source-patches-v96.zip` na raiz do repo.
2. `git add -A && git commit -m "v96: sigla da obra + numero de relatorio + revisao resultados" && git push`.
3. Netlify builda (check-source → biome → tsc → vitest → vite). Push do v96 cobre v94/v95.

### v96 — Sigla da obra (este pedido)
- Campo **`client_works.sigla`** exposto no **cadastro de obra** (Cadastros → Obras, `AdminListPage`) e no **assistente Nova obra** (`NovaObraWizard`).
- **Auto-geração:** ao digitar o nome, a sigla é preenchida com as **4 primeiras letras** (sem acento/espaço, maiúsculas) **só enquanto estiver vazia**; o usuário pode editar livremente, e a edição é respeitada.
- Mecanismo genérico novo no `FieldSpec`: `derive: { from, transform: 'first4letters' }`, processado no `AdminListPage` (deriva o destino se vazio). Coluna "Sigla" na lista de obras.
- A sigla vira o **prefixo do Nº de relatório** (`SIGLA-NNN/AAAA`); sem sigla, usa o sufixo do código da obra (`0001-...`).

### Backend — JÁ APLICADO no banco vivo (xbdvyvvxvzmcosnekmfv) via MCP. NÃO re-aplicar.
- **Migration 070** (LIVE): `client_works.sigla`; `concretagens.relatorio_seq`+`numero_relatorio`; trigger por obra+ano (advisory lock); UNIQUE; backfill.
- **EF generate-laudo-ensaio-pdf v16** (sha 33e2ba83, LIVE): lê `numero_relatorio`; upsert do laudo por `concretagem_id`.

### Frontend cumulativo (v94+v95)
- Resultados/rompimentos (v94): botões duplicados, Enter, re-save de lançados, operador, alerta < fck na idade de controle configurável, etc.
- Numeração (v95): coluna/exibição + filtro por Nº de relatório em Concretagens, Programações, Rompimentos, Laudos, Importações.

### Arquivos (15)
`public/sw.js`, `src/lib/telemetry/core.ts`, `src/lib/api/{types,concretagem,rompimento,importacao}.ts`, `src/components/patterns/AdminListPage.tsx`, `src/pages/cadastros/{CadastrosPage,NovaObraWizard}.tsx`, `src/pages/concreto/{RompimentosPage,ConcretagensPage,ProgramacoesPage,LaudosPage,ImportacoesPage}.tsx`, `supabase/functions/generate-laudo-ensaio-pdf/index.ts` (sync do repo; já LIVE).

### Gate local
check-source OK · **esbuild** (sintaxe + JSX + imports) OK em todos os arquivos tocados. tsc/vitest/vite rodam no Netlify.
