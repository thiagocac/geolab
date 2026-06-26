# GEOLAB → Concresoft — Patch v95 (cumulativo sobre v93)
## Número de relatório por obra+ano + revisão da tela de Resultados (v94)

Bump: `CACHE_NAME consultegeo-geolab-v95` + `APP_VERSION v95` (juntos).
Patch cumulativo: inclui as correções da tela de Resultados (v94) **e** a numeração de relatório (v95).

### Aplicar (sobe no GitHub → Netlify CI)
1. `unzip -o consultegeo-geolab-source-patches-v95.zip` na raiz do repo.
2. `git add -A && git commit -m "v95: numero de relatorio por obra + revisao de resultados" && git push`.
3. Netlify builda (check-source → biome → tsc → vitest → vite).

### Backend — JÁ APLICADO no banco vivo (xbdvyvvxvzmcosnekmfv) via MCP. NÃO re-aplicar.
- **Migration 070_numero_relatorio_por_obra** (LIVE): `client_works.sigla`; `concretagens.relatorio_seq` + `numero_relatorio`;
  função `obra_prefixo_relatorio`; trigger BEFORE INSERT `trg_concretagens_numero_relatorio` (advisory lock por tenant+obra+ano);
  UNIQUE `(tenant_id, work_id, numero_relatorio)`; backfill das concretagens existentes. (SQL completo abaixo.)
- **EF generate-laudo-ensaio-pdf v16** (sha 33e2ba83, LIVE): lê `conc.numero_relatorio` (fallback ao cálculo antigo);
  upsert do `lab_report` por `concretagem_id` (1 laudo/concretagem; atualiza o número p/ o formato novo nas revisões).
  O source atualizado vai no patch (supabase/functions/.../index.ts) só para sincronizar o repo.

### Numeração — como ficou
Formato `PREFIXO-NNN/AAAA`, sequência **por obra + ano** (reinicia anual), reservado **na criação da concretagem**
(programação inclusa). PREFIXO = `client_works.sigla`; se vazio, o sufixo do código da obra. Piloto: obra `OBRA-2026-0001`
sem sigla → `0001-001/2026`, `0001-002/2026`. (Defina `sigla` na obra p/ um prefixo curto tipo `AUR-001/2026`.)

### Frontend deste patch
- **Resultados/rompimentos (v94):** ver histórico — botões duplicados, Enter, re-save de lançados, operador, alerta < fck
  na idade de controle configurável, download seguro, import carga/massa, etc.
- **Numeração de relatório (v95):** coluna/exibição + filtro por Nº de relatório em **Concretagens, Programações,
  Rompimentos, Laudos e Importações**; selects de concretagem passam a trazer `numero_relatorio`.
- **NC:** não incluída no filtro por Nº de relatório — `non_conformities` liga-se à **obra** (não à concretagem) e já filtra
  por obra. Adicionar Nº de relatório ali exige desnormalizar a concretagem na NC (próximo incremento, se quiser).

### Arquivos
Frontend: `src/lib/api/{concretagem,rompimento,importacao}.ts`, `src/pages/concreto/{RompimentosPage,ConcretagensPage,ProgramacoesPage,LaudosPage,ImportacoesPage}.tsx`, `src/lib/telemetry/core.ts`, `public/sw.js`.
Backend (referência/sync): `supabase/functions/generate-laudo-ensaio-pdf/index.ts`.

### Gate local
check-source OK · **esbuild** (sintaxe + JSX + imports) OK em todos os arquivos tocados. tsc/vitest/vite rodam no Netlify.

---
## SQL da migration 070 (já aplicada — referência)
```sql
alter table public.client_works add column if not exists sigla text;
alter table public.concretagens add column if not exists relatorio_seq integer;
alter table public.concretagens add column if not exists numero_relatorio text;
-- função obra_prefixo_relatorio(uuid): sigla -> sufixo do código da obra -> 4 chars do uuid
-- trigger set_concretagem_numero_relatorio(): advisory lock por (tenant,obra,ano); max(relatorio_seq)+1; monta PREFIXO-NNN/AAAA
-- backfill por row_number() em (tenant,obra,ano) ordenado por created_at
-- unique index concretagens_numero_relatorio_uk (tenant_id, work_id, numero_relatorio) where deleted_at is null
```
