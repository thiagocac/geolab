# GEOLAB → Concresoft — SOURCE VERSION v60
CACHE_NAME: consultegeo-geolab-v59 · APP_VERSION: v59

## v59 — Observabilidade + Melhorias APLICADAS (banco) + tipos reais + melhoria do db tipado
Sobre o v58 (release combinado). Backend aplicado em producao via MCP; frontend buildando verde.

### Banco (APLICADO em xbdvyvvxvzmcosnekmfv — migrations 049-056)
- COLISAO resolvida: o vivo ja estava em 048_magic_links_portal -> o release foi renumerado 049-056.
- 049 core (9 tabelas telemetria + RLS) · 050 funcoes (11 SECURITY DEFINER) · 051 views (9 security_invoker) ·
  052 alarmes SQL (pg/release/email + 3 crons) · 053 cron (4 jobs; placeholders preenchidos) ·
  054 evidencias (tabela + RLS + storage) · 055 magic_link_aprovacao (criar_magic_link SUPERSET FIEL do vivo
  +'aprovacao_laudo' + consume_magic_link_laudo) · 056 evento_laudo_cliente (catalogo).
- Advisor seguranca pos-DDL: 0 ERROR (so 2 INFO rls_enabled_no_policy intencionais + WARN generico de SECURITY DEFINER).

### Tipos
- src/lib/database.types.ts REGENERADO do banco vivo (gen_types) — substitui os 7 stubs do v58 pelos tipos reais
  (telemetria + evidencias + views).

### Frontend (melhoria do db tipado)
- src/lib/api/concretagem.ts: removido o cast untyped `db = supabase as unknown as {from:(t)=>any}` -> `db = supabase`
  (client tipado). 3 casts localizados `as unknown as Database[...]['Insert']` so nos payloads dinamicos
  (createConcretagem, addCaminhao receipt+cps). Type-safety do fluxo de concretagem restaurada.
- Bump v59. npm run build verde: check-source · biome 0 erros · tsc 0 erros · vitest 18/18 · vite 8.1 build.

### Edge Functions
- DEPLOYADAS (2 novas, self-contained): approve-laudo-link (v1, public) · enviar-laudo-cliente (v1).
- PENDENTES (9, importam _shared -> exigem inline self-contained; nao deployadas p/ nao arriscar):
  NOVAS: client-telemetry, telemetry-alarm, extract-ficha-vision.
  INSTRUMENTADAS (redeploy de EFs VIVAS criticas — alto risco): generate-ficha-moldagem-pdf, generate-laudo-ensaio-pdf,
  portal-laudo-url, consulta-fiscal, client-portal-submit-programacoes, admin-create-client-user.

### PENDENTE (voce)
- Secrets no vault: CRON_SECRET (alarme/crons), VISION_API_KEY (OCR ficha), RESEND_FROM_EMAIL (envio ao cliente).
- Deploy das 9 EFs (inline self-contained — derivar as 6 instrumentadas do corpo VIVO via get_edge_function).
- Reconciliar o slot cron 'concresoft-telemetria' (033) que coexiste no minuto 0 com 'concresoft-telemetry-alarm'.
- H3: notification_dispatch_settings (dispatch_enabled/dry_run/allowlist) para envio real.
