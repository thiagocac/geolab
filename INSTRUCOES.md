# GEOLAB / Concresoft — Patch v222 (Onda A comercial: frontend + espelhos das EFs)

**Base:** v221 → **v222**.
**Bump:** `CACHE_NAME consultegeo-geolab-v222` + `APP_VERSION v222` já aplicados.
**Migrations 213–218 JÁ APLICADAS no vivo via MCP** (templates-hardening, catálogo v2, propostas v2, contratos v2, medição v2, financeiro AP/AR). Repo não versiona migrations.
**EFs novas JÁ DEPLOYADAS via MCP:** `commercial-public-action` v1 (sha aa7c0ef1…, verify_jwt=FALSE — token opaco + rate limit) e `send-commercial-document` v1 (sha ddcbde75…). **Os espelhos estão neste patch e DEVEM ser commitados** (regra espelho=vivo).

## Arquivos deste patch

- SOURCE_VERSION.md · public/sw.js · src/lib/telemetry/core.ts (bump)
- src/lib/api/productEvolution.ts (NOVO — API comercial unificada; generateDocumentPdf adaptado ao motor de blocos)
- src/lib/api/propostas.ts (estendida: save_proposal_v2, revisões, work_id/desconto/catálogo)
- src/pages/gestao/PropostasPage.tsx (v2: drawer, PDF, envio com link, conversão)
- src/pages/CommercialPublicPage.tsx (NOVO — página pública de aceite/aprovação)
- src/pages/gestao/ContractsV2Page.tsx · MedicaoV2Page.tsx · CashflowPage.tsx (NOVAS)
- src/pages/gestao/product/ProductUi.tsx (NOVO — helpers de UI)
- src/components/ui/State.tsx (EmptyState com título/descrição opcionais)
- src/App.tsx (rotas públicas /proposta/:token e /medicao/:token + 3 rotas de gestão)
- src/components/Layout.tsx (menu: Contratos v2, Medições v2, Fluxo de caixa)
- supabase/functions/commercial-public-action/index.ts (ESPELHO)
- supabase/functions/send-commercial-document/index.ts (ESPELHO)

## Fluxo ponta a ponta (teste após o push)

1. Financeiro → Catálogo: itens com preço sugerido (Criar itens padrão, se vazio).
2. Gestão → Templates de documentos: publicar o modelo de proposta (botão "Novo a partir do modelo de proposta" → Publicar).
3. Financeiro → Propostas: nova proposta com itens → Gerar PDF → Enviar (e-mail com anexo + link seguro de 30 dias).
4. Cliente abre /proposta/:token → Aceita → status muda, evento auditado, notificação interna.
5. Converter proposta aceita em contrato → Gestão → Contratos v2 (aditivos, saldo).
6. Medições v2: materializar itens → enviar para aprovação (/medicao/:token) → fatura → AR automático em Fluxo de caixa.

## Notas

- PropostasPage v2 substitui a anterior; a validação numérica v219 (clampNum) dos itens antigos não foi portada 1:1 — os campos novos têm min/max nativos; reforço do clamp fica para follow-up.
- Ondas B (capacidade+estoque) e C (ISO+premiação) do pacote GPT ficam para as próximas releases (SQL auditado guardado).
