# CHANGELOG v153 — Agenda de rompimentos agrupada por prensa — FE + EF v9

Base **v152**. Fecha o último item do mapeamento de equipamentos (o "controlar a agenda de cada prensa"
no papel) e o único que toca Edge Function. Encerra os Pacotes 1–3 (v150→v153).

## EF generate-agenda-rompimento-pdf — v8 → v9 (redeployada)
Re-derivada do **corpo vivo** (`get_edge_function`, v8, ezbr `f94e0c8f…`) antes de editar, como manda a
regra do projeto — a EF não estava espelhada no repo. Mudanças cirúrgicas sobre o v8:
- Novo parâmetro **`agrupar_prensa`** (bool). Default false → PDF **idêntico ao v8** (retrocompatível).
- Quando true: os CPs do recorte são particionados em **seções por prensa prevista**. A prensa prevista de
  um CP = prensa(s) **ativa(s) alocada(s) à obra** dele (`equipamento_obras`, join por `concretagens.work_id`).
  Seções ordenadas pelo rótulo `apelido || marca_modelo`, seguidas de **"Várias prensas alocadas"** (obra com
  N prensas) e **"Sem prensa alocada"** (obra sem alocação). Cabeçalho de seção com contagem, repetido com
  "(cont.)" no page-break.
- `work_id` entrou no SELECT de `concretagens`; alocação e rótulos carregados só quando `agrupar_prensa=true`
  (custo zero no caminho normal).
- Mantido: layout de colunas, as duas colunas em branco para caneta, Helvetica, self-contained, verify_jwt.

**Deploy confirmado**: version **8→9**, ezbr `f94e0c8f…` → `f4bcbbff…`.

## Frontend
- `gerarAgendaPdf` já era genérico (repassa o payload) — só `exportarAgenda(agruparPrensa)` ganhou o flag.
- Novo botão **"Agenda por prensa"** ao lado de "Agenda (PDF)", renderizado só quando há alocação viva
  (`alocQ.data.size > 0`) e o toggle de prensa está ligado. O PDF sai com o mesmo recorte de filtros da tela.

## Repo (espelhos)
- `supabase/functions/generate-agenda-rompimento-pdf/index.ts` — corpo **exato do deployado** (v9).
- `supabase/config.toml` — entrada `[functions.generate-agenda-rompimento-pdf] verify_jwt = true` (faltava).

## Teste manual
1. Alocar Prensa 1 → Obra A, Prensa 2 → Obra B (Drawer de equipamentos).
2. Rompimentos → "Agenda por prensa": PDF com seção "Prensa: Prensa 1" (CPs da Obra A), "Prensa: Prensa 2"
   (Obra B), e "Sem prensa alocada" para obras sem alocação.
3. Alocar as duas prensas à Obra A → CPs dela caem em "Várias prensas alocadas".
4. "Agenda (PDF)" (sem agrupar) → idêntico ao layout anterior.

## Gate (espelho Netlify) — exit 0
check-source **OK** (inclui a EF: kebab-case, index.ts, sem esm.sh) · biome **0 erros** (14 baseline) ·
tsc --noEmit **0** · vitest **23/23** · **vite build OK** · 0 `window.open(await…)`.

## Arquivos
`src/pages/concreto/RompimentosPage.tsx` (flag + botão) ·
`supabase/functions/generate-agenda-rompimento-pdf/index.ts` (novo espelho) · `supabase/config.toml`
(registro) · `public/sw.js` + `src/lib/telemetry/core.ts` (bump) · `SOURCE_VERSION.md` · este changelog.

## Fecha o mapeamento de equipamentos
Pacote 1 (v150, cadastro), Pacote 2 (v151, prensa no rompimento), Pacote 3 (v152 alocação + agenda
interativa, v153 agenda em PDF). **Restante — v1.1**: linha por prensa no digest diário (`cron-digest`);
prensa por CP na grade (hoje 1 por sessão); histórico de calibrações (supersede).
