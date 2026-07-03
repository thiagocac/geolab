# v155 — Auditoria v146→v154: correções (02/07/2026)

Release de correção derivada da auditoria completa da sessão que entregou v146→v154.

## Corrigido
1. **Espelhos de EF no repo re-sincronizados do VIVO** (`supabase/functions/`):
   - `generate-ficha-moldagem-pdf/index.ts` ← corpo vivo **v31** (modelo novo; o espelho no zip era o modelo antigo).
   - `generate-laudo-ensaio-pdf/index.ts` ← corpo vivo **v36** (Onda 4; idem).
   - Causa: a linhagem v146→v154 foi construída sobre o zip v145, anterior à blindagem de 30/06
     (`geolab-ef-fix-ficha-laudo-blindagem.zip`), que corrigiu só o GitHub. Com a integração GitHub→Supabase
     fazendo deploy em massa no push (entrypoints `/app/...`, 30/06 ~19:34 UTC, 17 EFs, versões +1),
     espelho velho no repo = regressão do incidente v143 no próximo push que os tocasse.
2. **Migration 134** (aplicada no vivo): `pendencias_resumo` exclui `status='cancelada'` de
   `prog_sem_caminhao` — o Cancelar (v139) grava `cancelada` (não soft-delete); cancelada sem caminhão
   contaria como pendência para sempre.
3. **Rompimentos — bip do QR** (v148): `bipEtiqueta` agora reseta também `prensaFiltro` (o filtro de
   prensa da v152 chegou depois do bip e podia esconder o CP bipado).
4. **Rompimentos — deep-link `?janela=atrasados`** (v154): semeia `dataRef = ontem()` — a lista passa a
   casar com a contagem do card (prevista < hoje); antes exibia atrasados + os de hoje.

## Auditado sem achados
- Migrations 130–133: guards com argumento, `SET search_path`, EXECUTE só `authenticated`,
  `ux_equipamento_obras_par` (full, on-conflict-reativa ok), `ux_corpos_prova_numeracao_lab_tenant`
  (por tenant, parcial), RLS habilitada.
- EF `generate-agenda-rompimento-pdf` v9 (ezbr `f4bcbbff…`): `agrupar_prensa` retrocompatível,
  self-contained, `npm:` only, Helvetica, `getUser` (sem atob).
- EF `generate-etiquetas-cp-pdf` v1 ativa; espelho e `config.toml` corretos.
- Invariantes do frontend: 0 `console.log/debug`, `<form>`, `localStorage`, `lucide`, `window.open(await…)`.
- v149: dep `xlsx` fora de package.json/lock; `excelParser` no `xlsx-js-style`.
- Consistência de empacotamento: patches v154 ⊂ completo v154 byte a byte; deep-links das 4 telas-alvo
  consomem e limpam os params; PendenciasPage filtra por papel e colapsa 0.
- Advisors (security): 0 ERROR; WARNs esperados (SECURITY DEFINER executável por authenticated = arquitetura).

## Backlog anotado (não corrigido aqui)
- Laudo EF: `isCtrl` hardcoda 28d — não respeita `idade_controle_default`/idade do traço (pré-existente).
- Status técnico da Central não distingue `cancelada` (aparece como programado).
- Agenda EF: `labName` pega o 1º vínculo sem `is_selected` (usuário multi-lab pode ver nome de outro lab no cabeçalho).
- Gate completo (biome/tsc/vitest/vite) não reproduzível no sandbox desta sessão (contenção npm); Netlify CI valida.
