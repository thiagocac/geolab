# GEOLAB — Release (Observabilidade + Melhorias dos Processos)

Pacote **único** com as duas frentes, pelos **caminhos reais do repo**:

- **Observabilidade** (9 camadas: coleta → ingestão → agregação → alarme → cron → painel).
- **Melhorias dos Processos Essenciais** (9 melhorias dos Processos 1–3: Ficha, Rompimentos, Laudos).

Detalhes de cada frente nos READMEs específicos inclusos:
- `README-observabilidade.md`
- `README-melhorias.md`

> **Nada foi aplicado em produção.** Migrations e EFs são aplicadas/deployadas por você (via MCP, *uma alteração por
> vez*). Os schemas foram conferidos por introspecção **read-only** do banco vivo (`xbdvyvvxvzmcosnekmfv`).

---

## Arquivos combinados (tocados pelas DUAS frentes) — já mesclados aqui
- **`src/App.tsx`** — contém a rota `/observabilidade` (obs) **e** o bloco público `/laudo/aprovar` (3.2).
- **`supabase/functions/generate-ficha-moldagem-pdf/index.ts`** — contém o wrap **`serveWithTelemetry`** (obs) **e** o **QR** (1.1).
- **`supabase/config.toml`** — unificado com as 8 entradas de `verify_jwt` (5 da obs + 3 das melhorias).

---

## Ordem de aplicação (combinada)

1. **Migrations** (MCP `apply_migration`, nesta ordem):
   `048` → `049` → `050` → `051` → `052` (observabilidade) → `053` → `054` → `055` (melhorias).
2. **`_shared/` e Edge Functions** — deploy e usar o `supabase/config.toml` incluso (já tem todas as entradas):
   - **Shared (obs):** `_shared/telemetry.ts`, `_shared/security.ts`, `_shared/response.ts`, `_shared/client.ts`.
   - **Instrumentadas (obs):** `generate-laudo-ensaio-pdf`, `generate-ficha-moldagem-pdf` (+QR), `portal-laudo-url`,
     `consulta-fiscal`, `client-portal-submit-programacoes`, `admin-create-client-user`.
   - **Novas (obs):** `client-telemetry` (`verify_jwt=false`), `telemetry-alarm` (`verify_jwt=false`).
   - **Novas (melhorias):** `extract-ficha-vision` (`true`), `approve-laudo-link` (`false`), `enviar-laudo-cliente` (`true`).
3. **Frontend** — sobrepor tudo de `src/` (o `App.tsx` e a ficha já vêm combinados).
4. **Regenerar `src/lib/database.types.ts`** — novas tabelas: as de telemetria (obs) + `evidencias` (melhorias).
5. **Service worker** — fazer o bump da versão do SW (o canary da obs espera `consresoft-geolab-v<N>` em `sw.js`),
   pelo mecanismo de bump do projeto.
6. **Secrets / config:**
   - **Obs:** `CRON_SECRET` no vault (crons da observabilidade); preencher `<PROJECT_REF>`/`<ANON_KEY>` no `052` se aplicável.
   - **G1 (vault):** `VISION_API_KEY` (OCR da ficha), `RESEND_FROM_EMAIL` (e-mail ao cliente). `RESEND_API_KEY` já existe.
   - **H3 (`notification_dispatch_settings`):** hoje `dispatch_enabled=false`, `dry_run=true`, allowlist
     `[thiago@consultegeo.com.br]`. Para enviar e-mail de verdade: `dispatch_enabled=true`, `dry_run=false`, ajustar allowlist.

---

## Validação
- **SQL** (`pglast`): migrations `048`–`055` OK.
- **TS/TSX/EFs** (`esbuild`): todos OK (inclui os dois arquivos combinados).
- **Unit** (`vitest`): `metrics-math` da observabilidade 14/14.
- **Schemas**: conferidos por introspecção read-only (magic_links, lab_reports, notification_*, lab_clients, buckets).
- **Sem execução em runtime** (sem Deno/conexão de app no ambiente de build).

---

## Ressalvas (resumo — ver os READMEs específicos)
- **Numeração**: `048`–`052` (obs) antes de `053`–`055` (melhorias). Aplicando só uma frente, renumere conforme o repo (source vai até `047`).
- **`extract-ficha-vision`**: endpoint de visão OpenAI-compatível; reconcilie o bloco `fetch(...)`/parse se sua `extract-nf-vision` usa outro provedor.
- **3.2 `reprovar`** → `em_revisao` com justificativa `[REPROVADO] …` (não há status `reprovado`).
- **3.1**: envia o laudo **anexando o PDF** (não há rota pública `/portal/m` nem download anônimo); gating por `notification_dispatch_settings`.
- **OCR/e-mail** degradam graciosamente sem G1/H3 (ficam armados/ociosos).
