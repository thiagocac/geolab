# CHANGELOG v152 — Equipamentos Pacote 3: alocação prensa↔obra + agenda por prensa — FE + migration 132

Base **v151**. Terceiro e último pacote do mapeamento de equipamentos (o que o Thiago mais pediu:
"alocação de prensa por obra e controlar a agenda de cada prensa"). FE + uma migration; sem EF.

## Migration 132 (APLICADA no vivo, 02/07)
`equipamento_obras` — vínculo N-N prensa↔obra, **espelho estrutural de `member_obras`**: `tenant_id`,
`equipamento_id`, `work_id`, `created_at`, `deleted_at`; UNIQUE cheio `(equipamento_id, work_id)` para o
ON CONFLICT reativar; índices parciais `(tenant, work)` e `(tenant, equipamento)`; RLS por tenant (SELECT
`is_tenant_member`, WRITE `is_tenant_writer`). RPC **`set_equipamento_obras(equipamento, work_ids[])`** no
molde de `set_member_obras`: guard `is_tenant_admin OR current_has_permission('equipamento.gerenciar') OR
is_tenant_writer`, **soft-delete** do que saiu, upsert reativando o que voltou. **Helpers exigem
`p_tenant_id`** (mesma divergência GEOMAT corrigida na 129/130 — a primeira tentativa da migration falhou
por `is_tenant_member()` sem argumento). Verificado: tabela + 2 policies + 4 índices; EXECUTE só a
`authenticated`/`service_role` (sem PUBLIC/anon — lição da 127). **Semântica SOFT**: alocação é default e
eixo de agenda, **não trava** o seletor de rompimento.

## (a) Alocação no Drawer de equipamentos
No cadastro de equipamento, quando o tipo é **prensa**, o Drawer ganha o bloco **"Obras alocadas"**: lista
de checkboxes com as obras do lab (`listObrasRef`), pré-marcada com a alocação atual (`getEquipamentoObras`)
e salva com `setEquipamentoObras` no mesmo submit. Para os demais tipos o bloco não aparece (alocação é
conceito de prensa). O id é resolvido uma vez no `salvar()` (refatoração das duas ramificações de gravação
em uma), então a alocação persiste tanto no cadastro novo quanto na edição.

## (b) Agenda por prensa em Rompimentos
O ponto de desenho: um CP **pendente** ainda não tem prensa gravada — a prensa "prevista" da agenda vem da
**alocação da obra** (obra → prensa). Um CP **lançado** já tem a prensa no resultado (`equipamento_id`,
Pacote 2). Um mapa `work_id → [equipamento_id]` de todas as alocações vivas (`mapAlocacaoObras`) sustenta:
- **Coluna "Prensa"** (gated pelo toggle): lançado mostra a prensa gravada; pendente mostra a **prevista**
  (`Prensa 1 (prev.)`, em cinza) ou "N prensas" se a obra tem várias alocadas.
- **Filtro de prensa** unificado: casa a prensa **gravada** (lançado) **ou alocada** (pendente); "Sem
  prensa" = pendente sem alocação (e sem prensa gravada).
- **Chips "Por prensa (recorte)"**: contam o recorte filtrado por prensa (lançado pela gravada, pendente
  pela prevista) — o "controlar a agenda de cada prensa" num relance; cada chip clica para filtrar.
- **Pré-seleção**: quando uma obra específica está filtrada e tem **exatamente 1** prensa ativa alocada, o
  seletor "Prensa utilizada" já vem preenchido com ela (não sobrescreve escolha manual; com N alocadas não
  presume). Reduz o clique repetido no fluxo comum de romper CPs de uma obra.

Necessário para (b): `concretagens.work_id` entrou no embed `SELECT_CP` de `rompimento.ts` (+ o tipo).

## Arquivos
`src/lib/api/equipamentos.ts` (+get/set alocação + `mapAlocacaoObras`) · `src/pages/cadastros/EquipamentosPage.tsx`
(picker de obras no Drawer) · `src/lib/api/rompimento.ts` (embed work_id) · `src/pages/concreto/RompimentosPage.tsx`
(coluna/filtro/chips/pré-seleção por prensa) · `docs/132_equipamento_obras_alocacao.sql` (novo) ·
`public/sw.js` + `src/lib/telemetry/core.ts` (bump) · `SOURCE_VERSION.md` · este changelog.

## Teste manual
1. Cadastrar 2 obras e alocar Prensa 1 → Obra A, Prensa 2 → Obra B no Drawer da prensa.
2. Em Rompimentos, filtrar Obra A → o seletor "Prensa utilizada" já vem com Prensa 1; coluna mostra
   "Prensa 1 (prev.)" nos pendentes; chip "Prensa 1: N".
3. Lançar → coluna passa a mostrar a prensa gravada (sem "prev."); chip recontabiliza.
4. Alocar as duas prensas à Obra A → coluna mostra "2 prensas" nos pendentes; nenhuma pré-seleção.
5. Filtro "sem prensa" isola pendentes de obra sem alocação.

## Gate (espelho Netlify) — exit 0
check-source **OK** · biome **0 erros** (14 warnings baseline; 4 hooks novos com `// biome-ignore`
justificado, padrão #G-biome-pipeline) · tsc --noEmit **0** · vitest **23/23** · **vite build OK** ·
0 `window.open(await…)`.

## Restante (v1.1 — fora deste release)
- **PDF da agenda agrupado por prensa** (re-derivar `generate-agenda-rompimento-pdf` do vivo + parâmetro
  `agrupar_prensa`) — o único item que toca EF.
- **Linha por prensa no digest diário** (`cron-digest`).
- **Prensa por CP na grade** (hoje é 1 prensa por sessão de lançamento) + histórico de calibrações.
