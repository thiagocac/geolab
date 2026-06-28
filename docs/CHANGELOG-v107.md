# CHANGELOG — v107 (KPIs do painel agregados no banco — item E)

**APP_VERSION:** v106 → **v107** · **CACHE_NAME:** consultegeo-geolab-v106 → **…-v107**
**Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Migration:** 1 (somente uma **função de leitura**; não altera tabelas nem dados).

> **Numeração:** os itens 1+2 (reconciliação de versões + "insatisfatório" na idade de controle) saíram como **v106**
> numa **sessão paralela** que compartilhou o repositório. Este item E é **v107**, exatamente como aquela sessão
> previu. Ver `docs/VERSOES-RECONCILIACAO.md` e `docs/CHANGELOG-v106.md`.

Fecha o item **E** da auditoria: o painel deixa de baixar agenda + laudos + equipamentos só para contar — os KPIs
são agregados no banco em **1 ida-e-volta**.

## Migration — `084_dashboard_kpis_rpc.sql` → `dashboard_kpis(p_tenant uuid)`
`SECURITY DEFINER`, `language sql`, `stable`, `set search_path = public`. Retorna 8 contadores:
`agenda_atrasados, agenda_hoje, agenda_proximos, agenda_total, laudos_rascunho, laudos_emitido, laudos_total,
calibracoes_vencendo`. Reproduz **exatamente** a lógica anterior do `getKpis`:
- **Agenda** = CPs pendentes (`situacao='pendente'`, não deletados): atrasados (`data_prevista < hoje`),
  hoje (`= hoje`), próximos (`> hoje`), total (todos os pendentes, inclusive sem data prevista).
- **Laudos** = `lab_reports` (não deletados): emitido (`status='emitido'`), rascunho (qualquer outro/nulo), total.
- **Calibrações vencendo** = `equipamentos` (não deletados) com `validade_calibracao` nos próximos 30 dias.

**Isolamento:** autorizada por **`is_tenant_member(p_tenant)`** (mesmo predicado do RLS) — caller não-membro recebe
zeros. `revoke` de `public`/`anon`, `grant` a `authenticated`. Reversível com `drop function public.dashboard_kpis(uuid)`.
Validado read-only no piloto: agenda 6/0/96/102 · laudos 0/2/2 · calibrações 0.

## Frontend
- `src/lib/api/dashboard.ts` — `getKpis(tenantId?)` agora chama a RPC `dashboard_kpis` e monta o objeto `Kpis`
  (mesmo formato). Removidas as 3 leituras + contagem no cliente e o **import órfão** de `listAgenda`. O call-site
  (`DashboardPage`) já passa `member.tenant_id` (desde v103); a RPC exige o tenant no parâmetro.

## Observações
- Comportamento idêntico ao anterior (mesmos números). `listAgenda` continua em `rompimento.ts` (tela de Rompimentos);
  apenas não é mais importada pelo dashboard.
- **Pré-requisito de deploy:** a migration 084 precisa estar aplicada no banco antes do frontend v107 ir ao ar
  (já aplicada em produção nesta sessão via MCP).

## Arquivos
`src/lib/api/dashboard.ts`, `src/lib/telemetry/core.ts`, `public/sw.js`, `SOURCE_VERSION.md`,
`docs/CHANGELOG-v107.md` + migration `supabase/migrations/084_dashboard_kpis_rpc.sql`.
