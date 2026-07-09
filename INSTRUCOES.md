# GEOLAB — v210 — instruções de aplicação

**Abatimento/slump migrado para milímetros (mm), a unidade da norma.** ABNT NBR 16889:2020 (ensaio, que substituiu a NBR NM 67:1998) e NBR 8953:2015 (classes de consistência S10–S220, todas em mm) trabalham em mm; o "cm" é conversão informal de obra. Para laboratório/acreditação (ISO 17025), o laudo em mm é o correto.

## Backend — JÁ APLICADO via MCP
A sincronização `slump_*_cm`↔`_mm` **já existia** no banco: triggers `aa_sync_slump` (`sync_slump_traco` em `operational_materials`, `sync_slump_receipt` em `material_receipts`), criados quando as colunas `_mm` foram adicionadas. Isso mantém o **frontend vivo (v189, cm)** e o **novo (v210, mm)** consistentes até o `_cm` ser aposentado.
- **mig 198** `198_slump_mm_canonical_reconcile`: backfill idempotente (mm=cm×10, já consistente). Criou também um trigger `reconcile_slump_units` que se mostrou **redundante** com o `aa_sync_slump`.
- **mig 199** `199_drop_redundant_slump_reconcile`: **removeu** o `reconcile_slump_units` + triggers (mantém só o `aa_sync_slump` pré-existente). Sync verificado por teste funcional (cm=8 → mm=80).
- `commit_excel_import` já é mm-canônico (lê `slump_*_mm` com fallback `slump_*_cm`×10); `dashboard_laboratorio_snapshot` já usa mm. Nenhuma view referencia slump.

## EFs (laudo e ficha) — DEPLOY NO PUSH (espelho atualizado neste zip)
Diferente das releases anteriores, **não deployei os EFs via MCP nesta sessão de propósito**: a linhagem v190→v209 inteira ainda está pendente de push (vivo = v189), e o laudo vivo (v67) + o app vivo (v189) estão hoje **consistentes em cm**. Deployar só o laudo em mm agora deixaria o documento em mm com a tela em cm. Ao subir o v210, o push redeploya os espelhos e **tudo vira mm junto** (tela + laudo + ficha). Os espelhos foram re-derivados fiéis ao vivo (laudo v67, ficha v58) e migrados para `_mm`:
- **generate-laudo-ensaio-pdf**: lê `slump_previsto_mm`/`slump_tolerancia_mm`/`slump_medido_mm`; label "Abatimento prev. (mm)" e "Slump X mm" (inteiro).
- **generate-ficha-moldagem-pdf**: idem; a ficha **já** rotulava "Abatimento espec. (mm)" e "Abat. (mm)" no cabeçalho — antes mostrava o valor em cm sob rótulo mm (inconsistente); agora o valor casa.

## Frontend (este zip)
- **Traço**: `MateriaisPage.tsx` + `lib/api/materiais.ts` — campos "Slump prev. (mm)"/"Tolerância (±mm)", defaults 100/20, leitura/gravação em `_mm`, lista em mm.
- **Medido (recebimento/caminhão)**: `ConcretagemDetalhePage.tsx` + `lib/api/concretagem.ts` — "Slump medido (mm)", grava `slump_medido_mm`.
- **Presets**: `lib/concreto.ts` — `TRACOS_PADRAO` ×10 ("SLUMP 100±20 MM"); **`parseSlumpFromDescricao` unit-aware** — texto de concreteira "10±2 CM" (ou sem unidade) vira mm (×10), "100±20 MM" fica mm; sempre retorna mm.
- **Import Excel**: `lib/importacao/excelModel.ts` — colunas `slump_*_mm`, exemplos ×10.
- **OCR da ficha**: `lerFichaImagem` remapeia o número cru que a EF `extract-ficha-vision` devolve na chave legada `slump_medido_cm` para `slump_medido_mm` (sem conversão — o número escrito na coluna "Abat.(mm)" já é mm). A EF de OCR **não precisou mudar**.
- **Laudo config**: `camposEnsaioLaudo.ts` — rótulo "Abatimento / slump medido (mm)".
- **Tipos**: `database.types.ts` — adicionadas as colunas `_mm` (mantidas as `_cm`).

## Pontos de atenção
- **Hábito de obra**: o moldador pode escrever cm por costume na ficha (que agora rotula mm) — a **tela de conferência do OCR** pega antes de salvar. Recomendo treinar para mm. (Follow-up sugerido p/ v211: hint de plausibilidade "valor < 40 parece cm" no campo medido.)
- **1 linha de dado outlier**: existe 1 `material_receipts` com `slump_medido_cm=100` (→ 1000 mm), provável erro antigo de digitação — revisar no lab.
- **`_cm` fica vivo** (sincronizado pelo trigger) até o v189 sair; um migration futuro pode dropar `_cm` + o trigger.

## Arquivos (patches)
- src/lib/concreto.ts
- src/lib/api/materiais.ts
- src/lib/api/concretagem.ts
- src/lib/api/rompimento.ts
- src/lib/importacao/excelModel.ts
- src/lib/concreto/camposEnsaioLaudo.ts
- src/lib/database.types.ts
- src/pages/cadastros/MateriaisPage.tsx
- src/pages/concreto/ConcretagemDetalhePage.tsx
- supabase/functions/generate-laudo-ensaio-pdf/index.ts (espelho → deploy no push)
- supabase/functions/generate-ficha-moldagem-pdf/index.ts (espelho → deploy no push)
- public/sw.js (CACHE_NAME v210)
- src/lib/telemetry/core.ts (APP_VERSION v210)

## Gate
check-source OK · biome 0 · vite build OK · esbuild dos 2 EFs OK. tsc/vitest no Netlify CI. Migration 198 já aplicada via MCP.
