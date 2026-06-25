# Concresoft — Patch v80 — Revisão da emissão/abertura de PDFs

## Resumo
Revisão completa de como o app **abre e baixa PDFs** (laudo, ficha, agenda, medição, anexo de NC, portal do cliente), aplicando práticas atuais de mercado. Só front-end. Combina com o fix de back já LIVE (migration 062 — policy de storage que liberou o download do laudo para o staff).

## Problema central corrigido
`window.open(url)` chamado **depois de um `await`** perde a ativação do usuário e é **bloqueado pelo popup-blocker** (o sintoma "clico e nada acontece"). Também havia nome de arquivo ruim no download e revogação prematura do objectURL (abortava o download em alguns navegadores) e vazamento de objectURL na medição.

## Solução
Novo util `src/lib/pdf.ts`:
- `saveBlob(blob, filename)` / `saveUrl(url, filename)` — download via `<a download>` (imune a popup-blocker, nome correto, revogação adiada).
- `openDeferredTab()` — abre a aba **síncrona** no clique e navega após o await (`tab.go(url)` / `tab.fail()`).
- `blobUrlAutoRevoke(blob)` — objectURL com revogação adiada para "abrir em nova aba".

Comportamento por relatório: **Baixar** = download com nome (ex.: `Laudo 000002-2026.pdf`); **Pré-visualizar/Gerar/Abrir** = nova aba sem bloqueio.

## Arquivos (substituir/adicionar no repo)
- **NOVO** `src/lib/pdf.ts`
- `src/lib/api/laudo.ts` · `src/lib/api/medicao.ts` · `src/lib/api/nc.ts`
- `src/pages/concreto/LaudosPage.tsx` · `NcPage.tsx` · `ConcretagensPage.tsx` · `ProgramacoesPage.tsx` · `ConcretagemDetalhePage.tsx` · `RompimentosPage.tsx`
- `src/pages/gestao/MedicaoPage.tsx` · `src/pages/portal/ClientePortalPage.tsx`
- `public/sw.js` (CACHE_NAME v80) · `src/lib/telemetry/core.ts` (APP_VERSION v80) · `SOURCE_VERSION.md`

## Aplicar
1. Copiar os arquivos sobre o working copy (base = v79: inclui ícones v78 + `_redirects` SPA v79).
2. `git add -A && git commit -m "v80: revisão da emissão/abertura de PDFs (anti popup-block + download nomeado)"`
3. `git push` → Netlify (geo-labs).

## Gate validado no sandbox
check-source OK · biome lint (exit 0; só warnings de hooks pré-existentes) · tsc --noEmit OK · vitest 18/18 · vite build OK.

## Observação de back (já aplicada, LIVE)
O download do laudo só funciona porque a **migration 062** adicionou a policy de storage `lab_laudos_read` (o bucket `lab-reports` só liberava o prefixo `logos/`). Isso já está no banco de produção; não depende deste push.
