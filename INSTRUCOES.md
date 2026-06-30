# INSTRUÇÕES — consultegeo-geolab v142 (Onda 3: Agenda de rompimentos PDF refeita)

**Use o COMPLETO v142** (cadeia cumulativa: v138 home+correções GPT · v139 Programações · v140 Onda 1 · v141 Onda 2 · v142 Onda 3).
Publicar (GitHub → Netlify `geo-labs` → app.concresoft.io).

## Edge Function — JÁ deployada no vivo (não vai pelo Netlify)
- **generate-agenda-rompimento-pdf v8** (ezbr `f94e0c8f…`, era `215bdf0b…`): relatório refeito no **visual da ficha de
  moldagem** (cabeçalho navy com o nome do laboratório, refs de norma, rodapé app.concresoft.io, grade limpa).
  Colunas: Numeração · Cliente/obra · NF · Idade · Data prevista + **duas colunas EM BRANCO** para preenchimento à
  caneta: **"Data / hora rompimento"** e **"Tensão de ruptura (MPa)"**. Se a tela estiver com **"Entrar carga"**
  marcado, a 2ª coluna em branco vira **"Carga de ruptura (<unidade>)"**. Respeita os filtros do recorte
  (tipo/idade/janela/data ref/busca + **cliente + obra**). Self-contained, StandardFonts.Helvetica, imports `npm:`.

## Frontend (3 arquivos)
- public/sw.js · src/lib/telemetry/core.ts → bump **v142**
- src/pages/concreto/RompimentosPage.tsx → `gerarAgendaPdf` passa `cliente`/`obra`/`entrar_carga`/`carga_unidade`
  para a EF (a agenda agora bate com o recorte filtrado e com o modo carga).

## Backlog (fase 2 do item G)
- **OCR da agenda preenchida à caneta** — quando o lab imprime a agenda e preenche os resultados à mão. Padrão
  `extract-ficha-vision` (QR + OCR dos manuscritos, idempotente por external_key, tela de conferência por confiança).

## Gate (espelho Netlify)
check-source OK · biome 0 erros · **tsc --skipLibCheck 0 erros** · vitest 23/23 · esbuild OK. EF parseada por esbuild.
