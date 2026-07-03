# CHANGELOG v154 — Tela de Pendências (Fase 1) — FE + migration 133

Base **v153**. Console consolidado do que exige ação no laboratório: um grid onde cada pendência mostra a
contagem, e o clique no número leva à tela dona já filtrada. Fase 1 do plano — as pendências P0, todas com
dado real e tela-dona pronta.

## Decisões (as 3 que estavam em aberto, seguindo minhas sugestões)
- **Drill-down por deep-link** (não lista inline): reusa Rompimentos/Concretagens/Laudos/NC, que já sabem
  listar e agir. Zero UI duplicada.
- **Rota `/gestao/pendencias`** como console próprio (exceção ao seletor de obra, como a agenda), com item
  no topo do menu ao lado de Painel/Dashboards.
- **Fase 1 = 6 pendências P0** com dado real: CP hoje, CP atrasado, CP pendente, programação sem caminhão
  (Operação); resultado insatisfatório, laudo a aprovar, NC aberta (Qualidade). ("CP sem numeração" ficou
  fora — 270 no piloto = ruído em lab sem numeração; entra na Fase 2 gated pelo toggle.)

## Migration 133 (APLICADA no vivo, 02/07)
`pendencias_resumo(tenant)` — SECURITY DEFINER, `SET search_path`, guard `is_tenant_member`, **uma passada**:
- Reusa `rompimentos_resumo` (não reconta) para pendente/atrasado/insatisfatório — herda a lógica da idade
  de controle (idade menor não reprova).
- Soma: CP a romper hoje (`data_prevista = current_date`), programação sem caminhão (concretagem sem
  `material_receipts` vivo), laudo aguardando (`lab_reports.status <> 'emitido'` — ciclo 1-etapa), NC aberta
  (`non_conformities.status = 'aberta'`).
- Retorna **JSONB `{ chave: {count, sev} }`** (só contagens; barato). Verificado: guard barra sem member;
  EXECUTE só `authenticated`/`service_role` (sem PUBLIC/anon, lição da 127). Registro em `docs/133_*.sql`.

## Frontend
- `src/lib/api/pendencias.ts` — chama a RPC, normaliza o JSON tipado.
- `src/pages/gestao/PendenciasPage.tsx` — grid por área (Operação/Qualidade). Cada item: título + **número
  grande clicável** + descrição + severidade (magenta=vencido/insatisfatório/NC, âmbar=hoje/atrasa/aprovar,
  cinza=informativo). **Colapsa contagem 0** ("Em dia: …"), **filtra por papel** (`hasRole`), estado feliz
  quando total = 0.
- Rota `/gestao/pendencias` + item "Pendências" (ícone AlertTriangle) no topo do menu.

## Drill-down (deep-link) — telas-alvo leem o param no mount e limpam a URL
- Rompimentos: `?janela=hoje|atrasados|pendentes|insatisfatorios` semeia janela/dataRef/insatisfatórios.
- Concretagens: `?filtro=sem_caminhao` → status técnico `programado` (as sem caminhão executado).
- Laudos: `?status=pendente` → **novo filtro de status** na tela (pendente = não emitido; seletor visível).
- Não-conformidades: `?status=aberta` → filtro de status **já existente**.

## Dados reais no piloto (no momento do deploy)
8 CPs atrasados · 102 pendentes · 17 programações sem caminhão · 14 NCs abertas · 2 laudos (emitidos).

## Arquivos
`src/lib/api/pendencias.ts` (novo) · `src/pages/gestao/PendenciasPage.tsx` (novo) · `src/App.tsx` (rota) ·
`src/components/Layout.tsx` (menu) · `src/pages/concreto/RompimentosPage.tsx` · `.../ConcretagensPage.tsx` ·
`.../LaudosPage.tsx` (+ filtro de status) · `.../NcPage.tsx` (deep-links) ·
`docs/133_pendencias_resumo.sql` (novo) · `public/sw.js` + `src/lib/telemetry/core.ts` (bump) ·
`SOURCE_VERSION.md` · este changelog.

## Teste manual
1. `/gestao/pendencias`: cards com contagens; áreas sem pendência mostram "Em dia".
2. Clicar "CPs atrasados" → Rompimentos com janela semeada, URL sem o param.
3. Clicar "Laudos a aprovar/emitir" → Laudos filtrado em não-emitidos.
4. Clicar "NCs abertas" → NC filtrado em abertas.
5. Como laboratorista, a seção Qualidade some (filtro por papel).

## Gate (espelho Netlify) — exit 0
check-source **OK** · biome **0 erros** (14 baseline; 4 seeds de deep-link com `// biome-ignore` de mount) ·
tsc --noEmit **0** · vitest **23/23** · **vite build OK** · 0 `window.open(await…)`.

## Fase 2 (P1 — próximo)
Conformidade: calibração vencida/vence-30d + certificação vencida/vence-30d (reusa os filtros que o v150/v146
já expõem em Equipamentos/Colaboradores) · exemplar pronto sem laudo · lote de importação em conferência ·
CP sem numeração (gated pelo toggle) · **drawer de detalhe genérico** (RPC `pendencias_detalhe(chave)`) para
as pendências sem tela-dona natural. Fase 3 (P2): financeiro/DocGate, role-gated.
