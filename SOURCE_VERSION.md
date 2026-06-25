# GEOLAB → Concresoft — SOURCE VERSION v58
CACHE_NAME: consultegeo-geolab-v58 · APP_VERSION: v58
(slug interno `consultegeo-geolab` mantido; marca visivel = **Concresoft**)

Frontend (acumulado v2→v58): …Portal do Cliente (v29) · Brand Kit (v30) · laudo dinamico v4 (v31) ·
rebrand Concresoft (v32-v33) · Medicao/faturamento (v35-v36) · Formas (v38) · Estatistica de lote NBR
12655 (v39) · Motor de NC (v40-v44) · laudo↔lote (v45) · OCR de DANFE/NF (v47) · Financeiro (v49) ·
code-splitting + xlsx lazy (v50) · Biome lint no gate (v51) · versao auto na UI (v52) · React 18→19
(v53) · React Compiler (v54) · rolldown-vite (v55) · Vite 8 nativo + plugin-react v6 + vitest 3 (v56) ·
Zod 4 — schema→tipo→validacao (v57) · Observabilidade + Melhorias de processos (v58).
(historico completo v2→v49 em git log + 08-changelog.)

## v58 — Observabilidade + Melhorias dos Processos (combinado sobre o v57 modernizado)
Integra o release "geolab-release" (duas frentes, construidas sobre o v57) a arvore modernizada
(React 19.2 + Compiler · Vite 8.1 Rolldown/Oxc · vitest 3 · Biome 2.5 · Zod 4 · TS bundler).

### Frentes
- OBSERVABILIDADE: client-telemetry (ingestao do browser) + telemetry-alarm (alarme horario) + 6 EFs
  instrumentadas (serveWithTelemetry) + migrations 048-052 (9 tabelas, 11 funcoes, 9 views security_invoker,
  3 alarmes SQL, crons) + painel /observabilidade (admin) + vitals canonico + supabase.ts com propagacao de trace.
- MELHORIAS Processos 1-3: ficha QR + OCR (extract-ficha-vision); evidencias (053); magic link de aprovacao
  de laudo (054 + approve-laudo-link + pagina publica /laudo/aprovar); enviar laudo ao cliente
  (enviar-laudo-cliente, 055); Rompimentos (fck so na idade de controle, faixa MPa, calibracao, legenda de
  ruptura, incerteza, "aplicar a N"); Laudos (multisselecao + pre-visualizar + gerar em lote).

### Correcoes aplicadas (para buildar verde no stack v57)
- metrics-math.test.ts: import alias `@/...` (nao configurado no projeto) -> relativo; +anotacao de tipo.
- database.types.ts: +7 STUBS de view/tabela (v_telemetry_mttr_summary, v_client_health_by_version,
  v_release_health, v_ef_metrics_hourly, v_client_vitals_daily, telemetry_alert, cron_heartbeat) p/ o painel
  tipar os from().select(). SAO STUBS — substituir por `gen:types` real APOS aplicar as migrations.

### Validacao (sandbox, gate completo) — EXIT 0
- check-source OK · biome 0 erros · tsc 0 erros · vitest 18/18 · vite 8.1 build OK.

### Pendencias de integracao (voce, via MCP) — detalhe em docs/v58-*.md
- Migrations 048-055 (uma por vez, list_migrations entre cada); regenerar database.types.ts; deploy das EFs
  com o config.toml; CRON_SECRET; G1 (VISION_API_KEY, RESEND_FROM_EMAIL); H3 (notification_dispatch_settings).
- Migrations 048-055 vem com CORPO COMPLETO (no source 029-047 e stub-comentario) — aplicar via MCP.
- Melhoria recomendada: re-tipar `db` em concretagem.ts (hoje cast untyped p/ evidencias) com uma tabela
  evidencias tipada — restaura type-safety do fluxo de concretagem.

> ATENCAO (deploy): o frontend v58 ja sobe (build verde com stubs), MAS as telas novas (/observabilidade,
> /laudo/aprovar, evidencias, enviar-laudo) so funcionam de verdade APOS aplicar migrations 048-055 + EFs +
> regenerar database.types.ts via MCP. Ate la, consultas a tabelas/views ainda inexistentes falham em runtime.
