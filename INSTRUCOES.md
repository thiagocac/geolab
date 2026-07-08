# INSTRUCOES — release v194 (RBAC matriz v2 + religação)

## O que é
Fase 1 (frontend) da auditoria RBAC: os gates de rota/menu/ação deixam de ser `hasRole(...)` fixo e passam a consultar a **matriz de permissões** via `can(chave)`. O backend (migrations 182/183) já foi aplicado no banco vivo via MCP — **não vai neste zip**.

## Arquivos alterados (subir no GitHub)
- `src/App.tsx` — guardas de rota `podeOperacao/podeGerirClientes/podeLab` → `can(chave)` (14 rotas). `podeLab` mantido só em `/gestao/seguranca-conta`.
- `src/components/Layout.tsx` — `Item.perm?` + helper `canSee` (usa `can` com fallback para `roles`); itens de menu anotados com a chave.
- `src/pages/concreto/ColetaFormasPage.tsx` — `can('coleta.executar')`.
- `src/pages/concreto/EtiquetasPage.tsx` — `can('etiqueta.gerenciar')`.
- `src/pages/gestao/BroadcastsPage.tsx` — `can('comunicado.gerenciar')`.
- `src/pages/gestao/FinanceiroPage.tsx` — aba Propostas: `can('proposta.ver')`.
- `public/sw.js` + `src/lib/telemetry/core.ts` — bump `consultegeo-geolab-v194` / `v194`.
- `SOURCE_VERSION.md` — changelog v194.

## Deploy
1. Commit dos arquivos acima no repo (fork do geomat) → push → **Netlify CI** builda (`check-source → biome → tsc → vitest → vite build`) e publica em https://lab.consultegeo.org.
2. Backend já no vivo (migrations 182 e 183). Nada a fazer no Supabase.

## Gate local (espelho do Netlify) — já rodado, verde
check-source OK · biome lint 0 erros · tsc --noEmit 0 · vitest 23/23 · vite build OK.

## Atenção (mudanças de comportamento)
- A matriz agora **manda** nessas rotas/menus. Papel sem a chave perde a rota (redirect) e o item de menu. `admin`/`admin_consulte` têm bypass no `can()` — nunca são travados.
- gestor_qualidade: ganha Observabilidade, Linha do tempo e gestão do Portal (default do seed).
- operador_campo: perde **gerar** etiquetas (mantém ver) e **/dashboards**.
- financeiro: ganha editar a **tabela de preços**.
- Ajuste fino de qualquer papel é no próprio app: **/gestao/rbac**.
