# CHANGELOG — v103 (Performance, frontend-only)

**APP_VERSION:** v102 → **v103** · **CACHE_NAME:** consultegeo-geolab-v102 → **…-v103**
**Origem:** auditoria de performance (ver `docs/PERF-RELATORIO-EXECUTIVO.md`, `docs/PERF-RELATORIO-TECNICO.md`).
**Sem** migration/Edge Function/mudança de banco. **Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).

## Contexto medido
No volume atual o banco tem ~18 MB e as maiores tabelas têm centenas de linhas. `pg_stat_statements` mostra que
**não há query de aplicação lenta** — o topo de tempo é `pg_sleep`, introspecção de schema do PostgREST/Studio e
runners de telemetria. Logo, os ganhos desta versão são **estruturais/preventivos**, não correções de lentidão atual.

## Mudanças (todas preservam o resultado funcional)
1. **`src/lib/api/rompimento.ts`**
   - `listCpsRompimento(tenantId?, opts?: { situacao?: string })` — novo filtro opcional de `situacao` aplicado
     **no servidor** (`.eq('situacao', …)`), nos dois caminhos (query principal e o fallback de `numeracao_lab`).
   - `listAgenda(tenantId?)` — agora delega para `listCpsRompimento(tenantId, { situacao: 'pendente' })`. Antes
     buscava **todos** os CPs e filtrava `situacao === 'pendente'` em JS. Mesmo conjunto de linhas; menos dados
     trafegados e menos linhas lidas à escala. Aceita escopo de tenant explícito.
2. **`src/lib/api/dashboard.ts`**
   - `getKpis(tenantId?)` — repassa o tenant para `listAgenda(tenantId)`. Contagens de `lab_reports`/`equipamentos`
     mantidas como estavam (preserva os números exatos do painel).
3. **`src/pages/DashboardPage.tsx`**
   - `useQuery({ queryKey: ['kpis', member?.tenant_id], queryFn: () => getKpis(member?.tenant_id) })`.
     Corrige **isolamento de cache multi-tenant**: antes a key era `['kpis']` (sem tenant), então ao trocar de
     tenant o painel podia exibir KPIs em cache do tenant anterior até um refetch. As demais telas já incluíam o
     tenant na key — agora o painel fica consistente.

## Por que o `tenant_id` explícito importa à escala
A política RLS de SELECT dos núcleos é `is_tenant_member(tenant_id)` (função STABLE/SECURITY DEFINER, avaliada por
linha e **não-sargável**). Sem um `tenant_id = '<uuid>'` explícito no `WHERE`, o planner não usa índice em `tenant_id`
→ seq scan + filtro por linha. Com o filtro explícito (que **não** muda o resultado, pois a RLS já restringe ao
mesmo tenant) o predicado vira sargável e habilita índice. Rompimentos e Concretagens já passavam `tenant_id`; esta
versão fecha a única leitura quente restante (o painel).

## Recomendado, NÃO aplicado nesta versão (ver relatórios)
- Índice composto `corpos_prova(tenant_id, situacao, data_prevista_rompimento) WHERE deleted_at IS NULL` quando a
  tabela crescer (hoje seria prematuro — 264 linhas).
- Limpeza dos ~267 índices nunca usados (`idx_scan=0`), só ~3 MB hoje — baixa urgência; inventário e script
  opcional (com salvaguardas) em `docs/PERF-INDICES-INVENTARIO.md` / `docs/PERF-INDICES-DROP-OPCIONAL.sql`.
- Combos/refs (`listReference`, `listClientesRef`, `listObrasRef`) sem `limit` → autocomplete remoto ou cap à escala.
- Listas grandes: trocar `count: 'exact'` por `estimated` acima de um limiar (hoje, com poucas linhas, `exact` é melhor).
- KPIs do painel como agregação SQL (`count` com `head:true` / RPC) em vez de contagem em JS, quando o volume subir.

## Arquivos tocados
`src/lib/api/rompimento.ts`, `src/lib/api/dashboard.ts`, `src/pages/DashboardPage.tsx`, `src/lib/telemetry/core.ts`
(APP_VERSION), `public/sw.js` (cache), `SOURCE_VERSION.md`, `docs/CHANGELOG-v103.md`.
