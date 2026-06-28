# CHANGELOG — v104 (Performance passe 2 + validação de upload, frontend-only)

**APP_VERSION:** v103 → **v104** · **CACHE_NAME:** consultegeo-geolab-v103 → **…-v104**
**Sem** migration/Edge Function/mudança de banco. **Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Relatório completo da auditoria:** `RELATORIO-PERFORMANCE-GEOLAB.md` (medições reais: `pg_stat_statements`, telemetria, bundle).

> **Colisão de numeração (importante):** o **v103** foi cortado por uma **sessão paralela** (perf do
> dashboard/rompimentos — ver `docs/CHANGELOG-v103.md`). Esta versão é o **passe 2**, com adições **distintas e
> aditivas** sobre o v103. Reconciliar a lineage depois. Os `docs/PERF-*` citados pelo v103 não estão nesta árvore.

## Contexto medido (confirma o v103)
No volume atual (piloto), o banco é minúsculo (maior tabela `corpos_prova` ~264 linhas) e o `pg_stat_statements`
não mostra **nenhuma** query de aplicação lenta — o topo é `pg_sleep`, introspecção do Studio/PostgREST e crons de
telemetria (milissegundos). Frontend já é code-split (rotas/recharts/xlsx sob demanda), 0 `console.log`,
`sourcemap: false`. Logo, os ganhos abaixo são **estruturais/preventivos**, não correção de lentidão atual.

## Mudanças — Performance (net-novo sobre o v103; todas preservam o resultado)
1. **`src/lib/api/dashboard.ts`** — `getKpis`: as 3 leituras independentes (`listAgenda` + `lab_reports` +
   `equipamentos`) agora rodam em **`Promise.all`** (1 ida-e-volta em vez de 3 sequenciais). Construído **sobre** o
   threading de tenant que o v103 já adicionou (`getKpis(tenantId?)` → `listAgenda(tenantId)`). Agregação em JS
   inalterada → mesmos números do painel.
2. **`src/lib/api/laudo.ts`** — `listConcretagensComResultado(tenantId?)` passa a filtrar `tenant_id` em
   `material_tests` (`.eq('tenant_id', …)` quando informado). Índice de tenant já existe → varredura indexada à
   escala; mesmo conjunto hoje (a RLS já restringe ao tenant).
3. **`src/lib/api/importacao.ts`** — `listConcretagensComPendentes(tenantId?)` idem para `corpos_prova`.
4. **`src/pages/concreto/LaudosPage.tsx`** — passa `member.tenant_id` ao helper e inclui o tenant na `queryKey`
   (`['conc-result', tenant_id]`) — isolamento de cache por tenant.
5. **`src/pages/concreto/ImportacoesPage.tsx`** — idem (`['imp-concs', tenant_id]`).
6. **`src/components/patterns/AdminListPage.tsx`** — `staleTime: 5 min` na query `['ref', …]` dos dropdowns de
   referência (dados estáveis) — menos refetch. As listas voláteis seguem nos 30 s globais.

## Mudanças — Validação de upload (etapa 10 da auditoria)
7. **`src/lib/upload.ts`** (novo) — `assertUploadSize(file, maxMB=15)` e `assertImagem(file)` (mensagens pt-BR).
8. **`src/lib/api/concretagem.ts`** — guarda em `fileToBase64` (OCR de **NF** e **ficha**) e em `uploadEvidencia`
   (foto → bucket `evidencias`): tamanho + "é imagem".
9. **`src/lib/api/nc.ts`** — guarda em `uploadAnexo` (anexo → bucket `anexos`): **tamanho** (tipo livre p/ PDF/doc).

> O anexo do **portal** já validava 8 MB (mantido). O limite de 15 MB é generoso para fotos de celular; o
> comportamento muda só ao rejeitar arquivos grandes ou não-imagem nos fluxos de imagem — o desejado.

## Recomendado, NÃO aplicado (precisam de decisão — ver relatório)
- **C — paginação server-side** nas listas que crescem (muda a UX; começar por uma tela de leitura).
- **E — KPIs do painel como agregação no banco** (RPC/`count head:true`) em vez de contar em JS (**DDL em produção**).
- **Índices:** não dropar os nunca-usados agora (prematuro); reavaliar com `idx_scan` real em escala. Índice
  composto em `corpos_prova(tenant_id, situacao, …)` só quando a tabela crescer.
- Reavaliar **Web Vitals reais** quando o RUM tiver volume (hoje ~127 eventos).

## Arquivos tocados
`src/lib/api/dashboard.ts`, `src/lib/api/laudo.ts`, `src/lib/api/importacao.ts`,
`src/pages/concreto/LaudosPage.tsx`, `src/pages/concreto/ImportacoesPage.tsx`,
`src/components/patterns/AdminListPage.tsx`, `src/lib/upload.ts`, `src/lib/api/concretagem.ts`,
`src/lib/api/nc.ts`, `src/lib/telemetry/core.ts` (APP_VERSION), `public/sw.js` (cache), `SOURCE_VERSION.md`,
`docs/CHANGELOG-v104.md`.
