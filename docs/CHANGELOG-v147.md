# CHANGELOG v147 — Etiquetas de CP com QR (rolo 60×40 + A4 21/folha) — FE + espelhos de repo

Base **v146**. Fecha o handoff `etiquetas-cp-frontend-handoff.md` da sessão de 01/07. O backend **já está
vivo e testado** desde 01/07 — este release entrega o botão e os espelhos de repo.

## Backend (já aplicado; NADA a aplicar neste release)
- **Migration 128** — UNIQUE de `numeracao_lab` trocado de escopo concretagem
  (`ux_corpos_prova_numeracao_lab_v23`) para **laboratório** (`ux_..._tenant`; troca segura: campo 100%
  vazio) + RPC **`atribuir_numeracao_cp_lote(concretagem)`**: advisory lock por (tenant, ano), `max+1`
  sobre `NNNN/AA` do ano, preenche **só CPs sem numeração** (idempotente — reimprimir nunca renumera),
  ordem amostra → idade → created_at (mesma da ficha). Testada com JWT simulado (`0001/26→0004/26`,
  2ª rodada 0 atribuídos) e **revertida** — sequência 2026 virgem.
- **Migration 129** — fix do guard: `is_tenant_writer(v_tenant)` (assinatura GEOLAB exige o argumento).
  Grants conferidos no vivo: EXECUTE só `authenticated`/`service_role` (sem PUBLIC/anon).
- **EF `generate-etiquetas-cp-pdf` v1** (ezbr `859c8e20…`, verify_jwt, self-contained padrão
  `generate-nc-report-pdf`): `{concretagem_id, layout: 'rolo'|'a4', cp_ids?}` → PDF inline. Valida
  numeração presente (**422** se faltar), ordena igual à RPC. Etiqueta: numeração grande (`0271/26`),
  QR vetorial **`CP:<uuid>`** (~20mm, nível M), nº do relatório, Mold./Romp. prev., idade em destaque,
  código do CP no rodapé. Layouts: **rolo** 60×40mm 1/página (térmica) e **A4** 21/folha 63,5×38,1
  3×7 (Avery L7160/Pimaco A4260; imprimir a 100%, sem ajuste de escala). Visual validado com bordas
  de debug na sessão de origem.

## Frontend (este release)
- **`src/lib/api/etiquetas.ts`** (novo, isolado): `numerarCps(concretagemId)` (RPC; lança se `ok:false`)
  e `etiquetasCpPdfUrl(concretagemId, layout, cpIds?)` (fetch autenticado → blob URL; espelho exato do
  `racPdfUrl`/nc.ts, `apikey` no header).
- **Concretagem › detalhe**: botões **"Etiquetas 60×40 (rolo)"** e **"Etiquetas A4"** na barra de ações
  (ao lado de "Gerar ficha PDF"). Fluxo do clique: aba síncrona (`openDeferredTab`, invariante
  `#G-popup`) → `numerarCps` (idempotente) → `tab.set(pdfUrl)`; erro → `tab.fail()` + toast.
  Reimpressão é a mesma ação e **nunca renumera**; `set_numeracao_cp` manual segue valendo para
  ajuste pontual.

## Repo (espelhos, mesmo commit)
- `supabase/functions/generate-etiquetas-cp-pdf/index.ts` — corpo **exato do vivo** (142 linhas,
  `get_edge_function`).
- `supabase/config.toml` — `[functions.generate-etiquetas-cp-pdf] verify_jwt = true`.
- `docs/128_numeracao_cp_sequencial_lote.sql` + `docs/129_fix_atribuir_numeracao_guard_arg.sql` —
  registros fiéis (128 anotada com o bug de origem; 129 = definição viva pós-fix).

## Teste manual (pós-deploy)
1. Concretagem com CPs → "Etiquetas 60×40 (rolo)": aba "Gerando…" → PDF 1 etiqueta/página; numeração
   inicia em `0001/26` (ou continua a sequência do ano).
2. Clicar de novo: mesmo PDF, **mesmos números** (idempotência).
3. "Etiquetas A4": grade 3×7 encaixada nas células (imprimir a 100%).
4. Ler um QR: conteúdo `CP:<uuid>`.
5. Usuário sem escrita: erro "sem permissao para numerar CPs".

## Notas
- **Bug latente pré-existente**: `set_numeracao_cp` (vivo) chama `is_tenant_writer()` sem argumento —
  mascarado pelo fallback do front (rompimento.ts). Corrigir em migration futura (mesmo fix da 129).
- **Fase 2 (barata)**: leitor USB de QR age como teclado — ensinar a busca da RompimentosPage a
  reconhecer `CP:<uuid>` e focar o CP bipado para lançar a carga.
- **Mídia física**: CP fica submerso no tanque de cura — usar **BOPP/poliéster com ribbon de resina**
  (transferência térmica) ou vinil A4 laser; papel comum/térmica direta não sobrevivem. Alternativa:
  etiquetar o **molde** na moldagem e colar a definitiva no desmolde (o mesmo PDF atende os dois).

## Arquivos
`src/lib/api/etiquetas.ts` (novo) · `src/pages/concreto/ConcretagemDetalhePage.tsx` ·
`supabase/functions/generate-etiquetas-cp-pdf/index.ts` (novo) · `supabase/config.toml` ·
`docs/128_*.sql` + `docs/129_*.sql` (novos) · `public/sw.js` + `src/lib/telemetry/core.ts` (bump) ·
`SOURCE_VERSION.md` · este changelog.

## Gate (espelho Netlify) — exit 0
check-source **OK** · biome **0 erros** (14 warnings baseline) · tsc --noEmit **0** · vitest **23/23** ·
**vite build OK**. Invariante: 0 `window.open(await…)`.
