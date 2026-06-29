# CHANGELOG v124 — Fix pop-up na emissão de laudo + EF otimizada (+ cumulativo ondas 1-4)

## Headline (v124)
- **src/lib/pdf.ts** — corrige o bloqueio de pop-up que afetava TODA abertura de PDF (laudo, medição, NC, ficha, portal).
  Causa: `openDeferredTab()` abria a aba síncrona com `noopener`, e `window.open('', '_blank', 'noopener')`
  retorna **null** → o truque da "aba síncrona" nunca segurava a janela e o `window.open(url)` pós-await era bloqueado.
  Agora: abre a aba SEM noopener (segura a referência), escreve uma tela de "Gerando…", e ao resolver navega a aba
  para o PDF. Se nem a aba síncrona abrir (bloqueio total), **faz download automático do PDF** (`saveBlob`) — nunca
  falha em silêncio. `opener` é anulado por segurança; revogação do blob adiada (120s na aba, 4s no download).
- **src/pages/concreto/LaudosPage.tsx** — passa rótulo de loading e nome de arquivo p/ o fallback de download.
- **EF generate-laudo-ensaio-pdf v18** (deploy via MCP; ezbr 92174d0…): auth + concretagem + gate documental e o
  lote de metadados (client/obra/tenant/traço/config/moldador) carregam **em paralelo** (antes era cascata sequencial)
  → o PDF fica pronto mais rápido, reduzindo o tempo de "aba em loading". Desenho do PDF inalterado.

## Backend acumulado (já aplicado via MCP — não entra nos zips)
Ondas 1-4: migrations 093-106; EFs generate-laudo-ensaio-pdf v18, auth-password-hook v1, dispatch-outgoing-webhooks v1.

## Frontend (entra nos zips v124)
8 telas das ondas 1-4 + o fix de pop-up. Bump sw.js + core.ts → v124.
