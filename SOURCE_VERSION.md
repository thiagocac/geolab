# GEOLAB → Concresoft — SOURCE VERSION v93
CACHE_NAME: consultegeo-geolab-v93 · APP_VERSION: v93
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v88): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) · React 19 +
Compiler (v53-54) · Vite 8 + vitest 3 (v56) · Tailwind v4/OKLCH (v60) · Base UI (v63-68) · ⌘K +
paste-to-fill + TanStack (v69-71) · Recharts (v73) · "Tipos de ensaio" (v75) · icones do menu (v78) ·
SPA fallback (v79) · **revisao da emissao/abertura de PDFs (v80-A)** · **Portal do cliente** (v80-B/v81) ·
ficha de moldagem Modelo A (v82) · consolidado (v83) · **revisao tipografica do laudo + toggle de
aceitacao (v84, v88)** · consolidado portal+ficha+e-mail/anexo ao cliente (v85) · +comentarios/contestacao
(v86) · +NF/OCR por caminhao (v87) · **export Excel** (xlsx-js-style; v89, v93) · papeis/permissoes do
cliente (v90-v92) · financeiro do portal + bloco v1.1 (v91) · Tipos de ensaio (v92). (historico v2→v49 em git log.)

## ⚠️ Branch divergente do pipeline (v80-B…v93, SEM `pdf.ts`) — resolvido por MERGE a cada release
Desde a v80-B o pipeline segue num **branch a partir da v79 que NUNCA reincorporou o `pdf.ts`** (a revisao
de PDF da v80-A, que esta NO AR). **Todos os completos v80-B…v93 vem sem `pdf.ts`.** Decisao (Thiago):
**manter tudo** (MERGE manual a cada release). Como detectar quando parar: `test -f completo-vN/src/lib/pdf.ts`
= SIM → o pipeline finalmente shipou e o merge manual deixa de ser necessario.

**Procedimento de MERGE por release** (validado v80-B…v93):
1. `unzip -o patch` sobre o repo (que JA tem `pdf.ts` + os arquivos da revisao de PDF mesclados).
2. `git diff --name-only HEAD` → ver quais arquivos do *pdfset* o patch tocou.
3. Para cada um: comparar com o completo da versao ANTERIOR — **identico → `git checkout HEAD -- <f>`**
   (o patch so re-enviou un-merged; restaura meu merge); **diferente → MESCLAR** (re-aplicar a revisao de PDF
   sobre o conteudo novo).
4. **Padroes de merge** (sempre os mesmos):
   - `src/lib/api/laudo.ts` → `downloadUrl(path, filename?)` + `{ download }`.
   - `src/pages/concreto/LaudosPage.tsx` → `openDeferredTab`/`saveUrl`/`blobUrlAutoRevoke` (preview/gerar/baixar) + `baixar(r: LaudoRow)`.
   - `src/pages/portal/ClientePortalPage.tsx` → `openDeferredTab` em `abrir` e `baixarAnexo`.
   - `src/pages/concreto/ConcretagensPage.tsx` e `ConcretagemDetalhePage.tsx` → `import { saveBlob as dl } from '../../lib/pdf'` (remove o `dl` local).
   - `src/pages/concreto/RompimentosPage.tsx` → `import { saveBlob as downloadBlob } from '../../lib/pdf'` (remove o `downloadBlob` local). **(novo na v89)**
   - `src/pages/gestao/MedicaoPage.tsx` → import `pdfMedicaoUrl`→`pdfMedicaoBlob` + `openDeferredTab`/`blobUrlAutoRevoke`; `gerarPdf` usa aba diferida. **(novo na v89)**
5. **`npm ci` quando `package.json` mudar** (v89 add `xlsx-js-style`) e **re-add o biome-ignore** em
   `src/lib/export/xlsx.ts` (linha do `slug`: `// biome-ignore lint/suspicious/noControlCharactersInRegex` — regex
   `/[^\x00-\x7F]/` que o pipeline re-envia sem o ignore → quebra o `biome lint`).
6. **Validar SEMPRE pelo exit code do BUILD** (`npm run build && echo OK`) — **nunca** `| tail` (mascara o exit) +
   `grep -c 'window.open'` = 0 nos pdfset. **NAO** confiar no "diff vs completo limpo" (completos branchamento inconsistente).

## Releases v84→v88
- **v84 / v88 — revisao tipografica do laudo + toggle de aceitacao:** `camposEnsaioLaudo.ts` + EF
  `generate-laudo-ensaio-pdf` (v84); `LaudosResultadosPanel.tsx` (v88). Sem conflito real de PDF.
- **v85 — consolidado:** portal (notificacoes, anexo no portal publico) + ficha + **e-mail/anexo ao cliente**
  (EFs `lab-client-portal` v10, `portal-anexo` v1, `notify-cliente-evento` v2).
- **v86 — consolidado:** + **comentarios/contestacao** de laudo (`ComentariosLaudo`).
- **v87 — consolidado:** + **NF/OCR por caminhao** (`extract-nf-vision`; `ConcretagemDetalhePage`).
- Backend de v84-v88 (migrations + EFs) **aplicado via MCP pelo pipeline** ("JA APLICADO", independe destes pushes).

## Releases v89→v93
- **v89 / v93 — helper de exportacao Excel + consolida v88:** novo `src/lib/export/xlsx.ts` (dep **`xlsx-js-style`**);
  RompimentosPage/MedicaoPage passam a exportar Excel (entram no pdfset de merge). **Fix recorrente:** o `biome-ignore`
  do control-char no `slug` do `xlsx.ts` (o pipeline re-envia sem ele) + `npm ci` (dep nova).
- **v90 — consolidado:** + **papeis/permissoes do cliente** (`portalPermissoes`).
- **v91 — consolidado:** + **financeiro do portal** (`listPortalFinanceiro`) + bloco v1.1.
- **v92 — consolidado:** + permissoes + **Tipos de ensaio** (catalogo). Sem conflito de PDF novo.
- Build verde a cada versao: check-source · biome 0 · tsc 0 · vitest · Vite 8.1. `pdf.ts` preservado (0 `window.open` cru).

## E-mail transacional — Concresoft Email Kit (fora do pipeline)
- Template "bulletproof" nos 2 senders Resend: **`send-notification` v10** (hub) e **`enviar-laudo-cliente` v5**.
  Lockup PNG `public/brand/concresoft-lockup-{white,color}-2x.png` — **repo-only, preservar**. `telemetry-alarm` v4
  corrigida; e-mail de alertas LIGADO. **REGRA FIXA: e-mail novo usa o Kit** (PK §3). Memoria geolab-email-architecture.
- Nota: v85 trouxe `notify-cliente-evento` (e-mail ao cliente) — confirmar que delega ao hub `send-notification` (Kit).

## Backend / infra (estado vivo; FONTE CANONICA = GEOLAB-Project-Knowledge.md)
- Migrations: **064+** (062-064 portal LIVE; 065+ de portal-anexo/comentarios/NF aplicadas via MCP pelo pipeline). 66+ tabelas · **EFs ACTIVE** · 13 crons.
- **E-mail real LIGADO**: `dispatch_enabled=true`, `dry_run=false`, **allowlist ABERTA**. `alert_notify_email=true`.
  Secrets `CRON_SECRET`/`RESEND_*`/`VISION_API_KEY` ✅.
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · RHF · TanStack · Recharts.

## Proximo: continuar portal/ficha. **Reinjetar `pdf.ts` na fonte do pipeline para encerrar o merge manual.** Piloto aberto.

> Nota: SOURCE_VERSION do pipeline vem stale; reescrito a mao (v60-v88). O branch do pipeline (v80-B…v93) **segue sem o
> `pdf.ts`** — merge manual a cada release (ver bloco acima). Repo AHEAD do completo de proposito; NAO reconciliar.
> 2 PNGs de lockup (e-mail) sao repo-only — preservar no clone/overlay.
