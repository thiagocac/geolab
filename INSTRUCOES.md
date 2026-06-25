# INSTRUÇÕES — Patch v82 (Ficha de moldagem Modelo A: em branco + pré-preenchida + OCR)

## Já aplicado por mim via MCP (nada a fazer no Supabase)
- **EF `generate-ficha-moldagem-pdf` v12** (sha `846fadcf…`) — reescrita para o **Modelo A (paisagem)**. Modos: **em branco** (body `{mode:'blank'}` ou sem `concretagem_id`) ou **pré-preenchida** (`{concretagem_id}`) com cabeçalho/dosagem da programação + QR do `concretagem_id`. pdf-lib, Helvetica.
- **EF `extract-ficha-vision` v4** (sha `fcf31a6e…`) — prompt do OCR alinhado às colunas do Modelo A (Abat→slump, NF, horários de transporte/descarga, volume Unit→volume_m3). Mantém o contrato de retorno (front inalterado).

## Frontend (vai pro GitHub → Netlify CI)
### Alterados
- `src/lib/api/concretagem.ts` (+ `invokeFichaBranco()`)
- `src/pages/concreto/ConcretagensPage.tsx` (botão **"Ficha em branco (PDF)"** no topo)
- `supabase/functions/generate-ficha-moldagem-pdf/index.ts` (ref.; já deployada)
- `supabase/functions/extract-ficha-vision/index.ts` (ref.; já deployada)
- `src/lib/telemetry/core.ts` + `public/sw.js` (v82)

## Local da funcionalidade (mapa)
A ficha vive na seção **Concreto ▸ Concretagens**:
- **Central de Concretagens** (`/concretagens`): botão **"Ficha em branco (PDF)"** (topo, imprimir em lote) + botão **"Ficha"** por linha (pré-preenchida da concretagem).
- **Detalhe da concretagem** (`/concretagens/:id`): **"Gerar ficha PDF"** (pré-preenchida) e, na etapa **"2 · Caminhões + CPs"**, **"Ler ficha preenchida"** → foto/scan → OCR (extract-ficha-vision) → conferência por confiança → cria caminhões + CPs (idempotente por `external_key = ficha:<NF>`).

Fluxo de campo: gerar ficha (branco ou pré-preenchida) → imprimir A4 paisagem → moldador preenche à mão → fotografar → "Ler ficha preenchida". O **QR** (na pré-preenchida) faz o casamento determinístico com a concretagem; o OCR lê só os campos manuscritos.

## Verificação
check-source OK; revisão independente do EF pdf-lib (layout conferido numericamente — cabe na página, índices ok, null-safe) e do frontend: **SHIP**. **Confirme o 1º print** (A4 paisagem, escala 100%) — o layout do EF foi portado do modelo reportlab já validado visualmente, mas o render do pdf-lib só dá para conferir imprimindo.
