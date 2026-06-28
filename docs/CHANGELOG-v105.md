# CHANGELOG — v105 (Paginação server-side nas listas que crescem — item C completo)

**APP_VERSION:** v104 → **v105** · **CACHE_NAME:** consultegeo-geolab-v104 → **…-v105**
**Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Migration:** 1 (somente uma **função de leitura**; não altera tabelas nem dados).

Fecha o item **C** da auditoria de performance: as listagens que crescem deixam de trazer tudo de uma vez.
Entregue em 3 fatias (NC → Concretagens/Laudos → Rompimentos).

## Migration — `rompimentos_resumo(p_tenant uuid)`
Função `SECURITY DEFINER`, `language sql`, `stable`, `set search_path = public`. Retorna os 4 contadores globais
(`pendente, atrasado, rompido, insatisfatorio`) calculados no banco, sem baixar os CPs.
**Isolamento:** autorizada por **`is_tenant_member(p_tenant)`** (o mesmo predicado do RLS) — caller que não é
membro do tenant recebe **zeros**, nunca dados de outro laboratório. `revoke` de `public`/`anon`, `grant` a
`authenticated`. Reversível com `drop function public.rompimentos_resumo(uuid)`.

## Fatia 1 — `NcPage` (não-conformidades)
- `src/lib/api/nc.ts` — `listNcs(f, tenantId?)` ganha `page`/`pageSize`, aplica `.range()` + `{ count: 'exact' }`
  e retorna **`{ rows, total }`** (antes: todas as NCs).
- `src/pages/concreto/NcPage.tsx` — 25/pág, Anterior/Próxima, contador, `keepPreviousData`, reset ao trocar
  Status/Obra (que já eram filtros server-side). Sem busca livre client-side → nada quebra.

## Fatia 2 — `ConcretagensPage` e `LaudosPage`
- `src/lib/api/concretagem.ts` — nova `listConcretagensPaged({ tenantId, clientId?, workId?, search?, page,
  pageSize })`: busca server-side (`ilike` em `numero_relatorio`/`codigo`/`fornecedor_texto`), filtros `.eq` de
  cliente/obra, `.range()` + count. **`listConcretagens`/`listProgramacoes` intactas.**
- `src/lib/api/laudo.ts` — nova `listLaudosPaged({ tenantId, workId?, search?, page, pageSize })` (`ilike` no
  `numero` + filtro de obra + paginação). **`listLaudos` intacta.**
- `ConcretagensPage`/`LaudosPage` — busca server-side + **dropdowns server-side** (Cliente/Obra em Concretagens;
  Obra em Laudos) + paginação. **Mudança de UX consciente:** a busca livre por *nome* de cliente/obra (que cruzava
  tabelas juntadas e não escala) virou dropdown server-side — **mesma capacidade**, agora escalável.

## Fatia 3 — `RompimentosPage` (bancada de lançamento)
- `src/lib/api/rompimento.ts` — nova `resumoRompimentos(tenantId)` chamando a RPC.
- `RompimentosPage` — a grade busca **só pendentes por padrão** (`listCpsRompimento(tenant, { situacao:'pendente' })`)
  e **tudo** quando "Mostrar Lançados/Insatisfatórios" está ligado (`carregarTudo`). Os 4 contadores passam a vir da
  **RPC** (globais, independem do recorte carregado). **Colar do Excel, aplicar a selecionados e Salvar em lote
  permanecem inalterados.** A invalidação existente (`['rompimentos']`) já atualiza os contadores (a query de resumo
  usa a chave `['rompimentos','resumo',tenant]`).

## Notas de comportamento (preservando o que já existia)
- **"Insatisfatório" (badge):** usa a **idade de controle** (migration **083**, a pedido) — abaixo do fck **na idade
  de controle** (config_lab.idade_controle_default, def. 28), alinhado ao destaque de linha da grade. No piloto passou
  de 86 (qualquer idade, versão 082) para **4**.
- **"Atrasado" (badge):** agora é **global "até hoje"** (`current_date`), independente da *Data de Referência* da
  grade. Por padrão coincide com o comportamento anterior (a Data de Referência inicia em hoje).

## Recomendado / não feito
- Manter **busca livre por nome** de cliente/obra (em vez de dropdown) exigiria índice de busca no banco
  (pg_trgm/RPC) — outra DDL; sob demanda.
- Reconciliar a numeração **v103/v104** (sessão paralela).

## Arquivos
`src/lib/api/nc.ts`, `src/pages/concreto/NcPage.tsx`, `src/lib/api/concretagem.ts`,
`src/pages/concreto/ConcretagensPage.tsx`, `src/lib/api/laudo.ts`, `src/pages/concreto/LaudosPage.tsx`,
`src/lib/api/rompimento.ts`, `src/pages/concreto/RompimentosPage.tsx`, `src/lib/telemetry/core.ts`,
`public/sw.js`, `SOURCE_VERSION.md`, `docs/CHANGELOG-v105.md` + migration `rompimentos_resumo`.
