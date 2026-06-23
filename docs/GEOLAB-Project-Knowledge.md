# GEOLAB — Project Knowledge

**Produto:** GEOLAB (Consulte GEO) — controle tecnológico de materiais para **laboratórios**. Concreto-first (NBR 5739), multi-material no núcleo.
**Inversão vs GEOMAT:** aqui o **laboratório é o tenant**; construtora e obra são **clientes** do lab.
**Supabase (GEOLAB):** `xbdvyvvxvzmcosnekmfv` · **Referência (GEOMAT, read-only):** `ssnvvvtxmzgxuedkpscs`
**Domínio:** `lab.consultegeo.org` · **Netlify:** `geo-labs` · **Repo:** fork de `thiagocac/geomat` (a criar)
**Atualizado:** 23/06/2026

---

## 1. Estado do banco (schema v1 completo)

19 migrations (001→019) aplicadas via MCP. **51 tabelas (100% RLS), 2 views (`security_invoker=on`), 133 policies, 8 funções.** Advisor de segurança: só 7 WARN esperados (helpers `SECURITY DEFINER` executáveis por `authenticated`, necessários à RLS). 0 FK sem índice.

Enums: `material_kind {concreto, solos, bloco_estrutural, argamassa, graute, cbuq}` · `record_status {rascunho, registrado, pendente, aprovado, reprovado, concluida, aberta, cancelada}`.

Helpers RLS: `current_tenant_id()`, `current_member_id()`, `is_tenant_member()`, `is_tenant_writer()` (role **ou** roles[]), `is_tenant_admin()`, `has_role()`, `select_tenant()`, `set_updated_at()`.

Fluxo core no schema: `lab_clients → client_works → concretagens → material_receipts → amostras → corpos_prova → material_tests → lab_reports → laudo_resultados`, + `workflow_engine` (schema), NC (DB-ready, desligado), pipeline de e-mail (seed seguro).

### Migrations
| # | Nome | # | Nome |
|---|---|---|---|
| 001 | foundation | 011 | concretagem_core |
| 002 | clients_works_contacts | 012 | cp_resultados |
| 003 | security_hardening | 013 | laudos |
| 004 | writer_roles_and_fk_indexes | 014 | workflow_engine |
| 005 | colaboradores | 015 | contrato_ref |
| 006 | equipamentos | 016 | formas_ready |
| 007 | catalogo | 017 | nc_ready |
| 008 | estrutura_opcional | 018 | email_catalog |
| 009 | config_lab | 019 | fk_indexes |
| 010 | harden_is_tenant_admin | | |

## 2. Infra e seed

- **Buckets** (privados): `lab-reports`, `evidencias`, `fichas`, `anexos`, `backups`.
- **Secrets no vault:** `RESEND_API_KEY` ✅. Faltam: `RESEND_FROM`/`RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`.
- **Lab piloto LabTest** (slug `labtest`) + admin, criados por **seed SQL direto** (auth.users + identity + member + config_lab; `pg_net` indisponível p/ invocar EF):
  - `tenant_id = 286201a0-eeb2-44d8-b2e3-bee5273c80c9`
  - admin **thiago@consultegeo.com.br** — `member_id = d9543675-0273-4bb6-aba7-78b3bcdd88c1`, `auth_id = 962b13df-07ad-4b14-8c0a-811f4d5aa47e`, role `admin` + roles `[admin, admin_consulte]`, senha temporária (trocar).

## 3. Edge Functions deployadas (GEOLAB)

| EF | Versão | Observação |
|---|---|---|
| `generate-ficha-moldagem-pdf` | v1 | re-derivada/adaptada ao schema GEOLAB |
| `generate-laudo-ensaio-pdf` | v1 | laudo v4; **aceitação por exemplar v1** (não estatística de lote) |

Deploy estrutural (compilado); **validação funcional pendente** via concretagem de teste `CONC-2026-TEST01` (`b09ff792-8254-4f40-aa14-9c332aef16c0`) + script `validar-efs-pdf.sh`.

## 4. Decisões de re-derivação (divergem da spec proposta)

`is_tenant_writer` com `roles[]` · `is_tenant_admin` novo · **`padrao_moldagem` jsonb em `operational_materials`** (não tabela) · `material_test_types.tenant_id` nullable (catálogo global) · equipamentos com nomes do GEOMAT (`marca_modelo`/`validade_calibracao`/`lab_calibrador`) · concretagens com `client_id` + `fornecedor_texto` · **slump em cm** · corpos_prova com `amostra_id` + `situacao` text · `lab_reports.status` text · workflow só schema (RPCs adiadas) · NC desligado.

---

## 5. Workflow de release — REGRA DOS DOIS ZIPS (herdada do GEOMAT)

Toda interação que altere o frontend produz **dois zips**, numeração contínua a partir de **v1**:

1. **`consultegeo-geolab-source-completo-vNN.zip`** — source integral do repositório (referência; **não** vai pro GitHub).
2. **`consultegeo-geolab-source-patches-vNN.zip`** — só os arquivos alterados + **`INSTRUCOES.md`** na raiz. **Este sobe no GitHub** (→ Netlify CI).

**Conteúdo de cada zip** (padrão GEOMAT): `src/` (frontend), `supabase/functions/` + `config.toml`, `public/sw.js`, metadados (`SOURCE_VERSION.md`, `docs/release-vNN.md`). **Migrations NÃO entram nos zips** — são aplicadas via MCP e documentadas como "vivas" (este PK + release notes).

**Contrato de cache (absoluto):** cada release bumpa **`CACHE_NAME`** (`public/sw.js`) **e** **`APP_VERSION`** (`src/lib/telemetry/core.ts`) **juntos** via `npm run bump vNN` (ex.: `consultegeo-geolab-v2` / `v2`). O guard do `check-source` falha o build se divergirem. SW é só versionamento de assets (sem offline).

**Gate de build (espelho Netlify):** `check-source → tsc --noEmit → vitest run → vite build`. Produção: `VITE_DEMO_MODE=false`.

**Deploys:** frontend GitHub→Netlify (único canal, nunca editar JS minificado). EFs via MCP `deploy_edge_function` (entrypoint `index.ts`, imports `npm:` apenas; `ezbr_sha256` tem que mudar para contar). Migrations via `apply_migration`, uma a uma, `list_migrations` entre cada, aditivas/idempotentes, sem DROP.

**INSTRUCOES.md (no patches)** segue o molde GEOMAT: *O que entra · Arquivos a commitar · Backend já aplicado via MCP · Gate (CACHE/APP_VERSION) · Smoke pós-deploy.*

---

## 6. Próximos passos

1. **Validar** as EFs de PDF com `CONC-2026-TEST01` (script `validar-efs-pdf.sh`).
2. EFs `send-notification` + `notify-event` (re-derivar; exigem os secrets de e-mail).
3. EFs `extract-laudo-vision`/`-texto` (OCR da ficha).
4. **RPCs do workflow** (`decide_approval_step`, `instantiate_workflow`, `notificar_autor_workflow`, `get_effective_workflow`, `resolve_workflow_template`, `validate_workflow_transition`) — re-derivar do GEOMAT.
5. **`admin-create-lab`** para produção (console operação interna).
6. **Frontend:** criar o fork do `thiagocac/geomat`, reidentificar (CACHE/APP_VERSION/Supabase/branding) e adaptar telas ao schema GEOLAB. A partir daí, a regra dos dois zips passa a valer a cada release.
