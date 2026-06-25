# GEOLAB → Concresoft — SOURCE VERSION v78
CACHE_NAME: consultegeo-geolab-v78 · APP_VERSION: v78
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**; app em `app.concresoft.io`)

Frontend (acumulado v2→v78): …Brand Kit (v30) · Motor de NC (v40-v44) · Financeiro (v49) ·
code-splitting (v50) · React 18→19 (v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 +
vitest 3 (v56) · Zod 4 (v57) · Observabilidade (v58) · backend aplicado + tipos reais (v59) ·
Tailwind CSS v4 + OKLCH (v60) · tipografia editorial + motion (v61) · View Transitions (v62) ·
Base UI + ConfirmDialog (v63) · Cadastro em Drawer (v64) · Validacao RHF + Zod (v65) · Modal -> Base UI
Dialog a11y (v66) · "Nova programacao" dedicada (v67) · Tooltip (v68) · ⌘K Command Palette (v69) ·
paste-to-fill (v70) · TanStack Table + Virtual (v71) · UX dos modais de cadastro (v72, v76) · Recharts na
Observabilidade (v73) · correcoes auditoria v60→v73 (v74) · Cadastro de "Tipos de ensaio" (v75) ·
Reconciliacao modernizacao+dominio (v77) · revisao dos icones do menu lateral (v78). (historico v2→v49 em git log.)

## v60→v78 — Overhaul de design / UX por fases (sem mudanca de schema)
- **Fase 2 (v60-v62):** Tailwind v4 + tokens OKLCH · paleta navy + papel morno + tipografia editorial + motion · View Transitions.
- **Fase 3 (v63-v68) — Base UI:** ConfirmDialog · Drawer de cadastro · RHF + Zod · Modal a11y · "Nova programacao" · Tooltip.
- **Fase 4 (v69-v72, v76) — produtividade/UX:** ⌘K Command Palette · paste-to-fill · TanStack Table + Virtual ·
  UX dos modais de cadastro — scroll/alinhamento/foco (preparada na v72, re-aplicada na v76).
- **Fase 5 (v73-…) — visualizacao:** Recharts na Observabilidade (chunk `charts` no Vite); `DashboardCharts.tsx`
  (componente de graficos) consumido por `DashboardPage`.
- **v74:** correcoes da auditoria v60→v73. **v75:** CRUD de "Tipos de ensaio" (`material_test_types`, migration 006, sem migration/EF nova).
- **v77 — Reconciliacao (pipeline):** alinha modernizacao v60→v74 + "modais v72" (merge de Field/Colaboradores/Materiais
  com useConfirm/error) + dominio v52 (`lab.consultegeo.org` -> `app.concresoft.io`). Sem dep nova.
- **v78 — Icones do menu lateral:** novos SVG em `src/components/ui/icons.tsx` + mapeamento em `src/components/Layout.tsx`
  (Concretagens=betoneira, Rompimentos=prensa, Preferencias=engrenagem, Medicao=regua, Faturas=recibo, Formas=molde,
  Usuarios cliente=pessoas, Config NC=sliders); resolve colisoes de icone. Sem banco/EF/rota/logica.
- Build verde: check-source · biome 0 · tsc 0 · vitest · Vite 8.1 (Rolldown/Oxc). Deps: base-ui/rhf/tanstack/recharts.

## E-mail transacional — Concresoft Email Kit (aplicado nesta sessao, fora do pipeline)
- Template "bulletproof" (header gradiente + lockup PNG de `app.concresoft.io/brand/`, kicker mono, botao MSO/VML,
  caixa de detalhes, rodape LGPD) nos 2 unicos senders Resend: **`send-notification` v10** (hub) e
  **`enviar-laudo-cliente` v5** (laudo PDF anexado).
- Lockup PNG `public/brand/concresoft-lockup-{white,color}-2x.png` — repo-only, NAO vem no source-completo; **preservar**.
- Auditoria das 27 EFs: cobertura TOTAL — digests/alarme/watchdog/notify-event delegam ao hub (herdam o template).
- **`telemetry-alarm` v4 corrigida:** chamava o hub com contrato errado (Bearer service-role + recipient_member_id/link
  -> 401/400, alertas nunca saiam); realinhada a `x-notify-secret` + `member_id` + `deep_link`. Detalhes na memoria geolab-email-architecture.

## Backend / infra (estado vivo; FONTE CANONICA = GEOLAB-Project-Knowledge.md; v60-v78 nao mexem no schema)
- Migrations **001-056** · 66 tabelas (100% RLS). **27 EFs ACTIVE** · **13 crons ATIVOS**.
- **E-mail real LIGADO**: `dispatch_enabled=true`, `dry_run=false`, **allowlist ABERTA** (passa-tudo). Secrets `CRON_SECRET`/`RESEND_*`/`VISION_API_KEY` ✅.
- **E-mail de alertas de telemetria LIGADO**: `telemetry_settings.alert_notify_email=true` (so dispara em alerta critico
  NOVO; destinatario unico hoje: thiago@consultegeo.com.br via `telemetry_admin_member_ids`).
- Stack: React 19.2 + Compiler · Vite 8.1 · vitest 3 · Biome 2.5 · Zod 4 · Tailwind 4 · Base UI · RHF · TanStack Table + Virtual · Recharts.

## Proximo: continuar Fase 5 (visualizacao). Piloto aberto (allowlist + alertas por e-mail ligados).

> Nota: o SOURCE_VERSION do pipeline traz so a ultima release + corpo antigo (v59); este foi reescrito a mao p/ refletir
> v60-v78. Os patches v72-v78 NAO somam exatamente ao source-completo (dep recharts; `DashboardCharts.tsx` removido na v76
> e re-adicionado pelo completo-v78; paginas) — o completo e AUTORITATIVO, reconciliado a mao. Os 2 PNGs de lockup sao add
> manuais (e-mail) e NAO estao no source-completo — preservar no clone/overlay dos proximos releases.
