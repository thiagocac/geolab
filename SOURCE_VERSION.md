# GEOLAB → Concresoft — SOURCE VERSION v134
CACHE_NAME: consultegeo-geolab-v134 · APP_VERSION: v134
(**30/06 — v133**: 2 toggles novos em Config. de Campos › Concretagem, default OFF, para a FICHA: `ficha_contato_equipe` (Contato/Equipe/Ref. no cabeçalho) e `ficha_dosagem` (linha de dosagem detalhada pré-preenchida do traço). Acompanha a EF generate-ficha-moldagem-pdf **v21** (ezbr cb457923) (logo dinâmica do lab, sem Consulte GEO, print-friendly, coluna Numeração gated por numeracao_cp_manual, colunas/campos dinâmicos por Config. de Campos, Cód.→Número do relatório). Cumulativo sobre v132.)
(**30/06 — v132**: numeração de CP manual na MOLDAGEM. Toggle `recebimento_campos.numeracao_cp_manual` (Config. de Campos › Recebimento, DESMARCADO por padrão) liga, no modal Caminhões + CPs, um campo de numeração por CP + botão **Gerar numeração** (digita o nº do 1º CP — menor idade — e o sistema preenche a sequência via helper `bumpNumeracao`, BigInt, preserva prefixo/zero-pad). `addCaminhao` grava em `corpos_prova.numeracao_lab` (coluna já existia; reusada — aparece em rompimento/laudo/portal). **Frontend-only, sem migration/EF.** Complementa a v131, que registrava a numeração na tela de Rompimentos.)

> **v134 (Claude):** **Linha do tempo embutida** (gap #1 da revisão), **re-baseado sobre v133** — inclui v130/v131/v132/v133 (sessões paralelas) + a timeline. Componente `TimelineList`; na **concretagem** card "Linha do tempo" com toggle [Desta concretagem | Desta obra] + "Abrir completa"; `/gestao/timeline` deep-linkável (`?scope=&id=`). Gate completo rodado local (check-source/tsc/vitest 23/23/vite build verdes).

> **v131 (Claude):** **Numeração do laboratório vira toggle de ensaio** (`numeracao_lab`, ligado por padrão) — em Config. de Campos › Ensaio; desligado, some o botão "+ numeração lab" de cada CP na tela de Rompimentos. E o **label do filtro de busca em Rompimentos** mudou de "Nota fiscal" para **"Buscar"** (o campo aceita Nº relatório, NF, código ou numeração). Base v130.

> **v130 (Claude) — FIX crítico do RBAC:** corrige o erro `Cannot read properties of undefined (reading 'rest')` em **Papéis e permissões**, **Operação › Usuários**, **Linha do tempo** e **Documentos e gate**, e o carregamento de permissões no login. Causa: helpers extraíam `const rpc = supabase.rpc` (perde o `this`; no supabase-js v2.45 o `.rpc()` usa `this.rest`). Correção: `.bind` em rbac.ts/operacao.ts/auth.tsx/docgate.ts/timeline.ts. Sem o fix, `current_member_permissions` falhava em silêncio e **não-admins ficavam sem permissões** (só admin via guarda-chuva). Base v129.

> **v129 (Claude):** **RBAC Fase 2.** Migration **111** (`seed_builtin_roles_and_permissions` reutilizável + backfill `member_roles` + `member_effective_permissions`). EFs: **admin-create-lab v8** (semeia papéis+matriz em novos labs) e **admin-reset-password v1** (nova; redefine senha). Frontend: ficha de usuário ganhou **Redefinir senha** + **Permissões efetivas**; gates religados a `can()` em Medição/Faturas/Config. de Campos/Lotes/NC. Base v128.

> **v128 (Claude):** **gestão de usuários robusta + matriz de permissões detalhada (RBAC religado).** Migrations **109** (catálogo de 59 permissões em 17 categorias com risco/descrição + seed da matriz nos 7 papéis built-in) e **110** (RPCs current_member_permissions/list_lab_members/set_member_obras/set_member_override/update_member/upsert_role/clone_role/set_role_active). Frontend: `can()` no auth (autoriza por permissão, guarda-chuva admin); **Operação › Usuários** reformada (busca/filtros, chips, escopo de obras, exceções, último acesso, ficha de edição com múltiplos papéis); **Acessos › Papéis** reformada (matriz agrupada por categoria+risco+busca; criar/clonar/editar/desativar papel custom); Laudos religado a `can('laudo.aprovar')`. Base v127.

> **v127 (Claude):** **escopo de construtora para traços** (obra › construtora › catálogo do lab). Migration **108** adiciona `operational_materials.client_id` (FK lab_clients) + backfill dos traços de obra. Os seletores de traço (Nova programação, Central, Detalhe) passam a respeitar a **cadeia de escopo** e agrupam por origem ("Desta obra/Da construtora/Catálogo" — componente `TracoOptions`). **Materiais** ganha picker de escopo, filtro por construtora, badge de origem e ação **Duplicar/Promover**. Verificado vivo: traço repete entre obras da mesma construtora, isolado entre construtoras. Base v126.

> **v126 (Claude):** novo campo **Operador (quem rompeu)** em **Config. de Campos › Ensaio**, **desligado por padrão**. Quando desligado, o seletor de operador some da tela de **Rompimentos** e o `operador_id` não é gravado; a **DocGate** também deixa de emitir os avisos de operador (`operador_nao_informado`/`operador_certificacao_vencida`) — migration **107** (já aplicada). Frontend cumulativo sobre base v125.

> **v125 (Claude):** tela única **Config. de Campos** (`/gestao/config-campos`) com abas Ensaio/Laudo/Recebimento/Concretagem, substituindo os 3 itens de menu (Campos do ensaio e laudo / Campos recebimento / Campos concretagem) — rotas antigas redirecionam. Os toggles de "Campos exibidos no laudo" saíram de **Preferências** (eram duplicados de laudo_campos; agora só na aba Laudo). Defaults de recebimento/concretagem alinhados ao consumidor (EF) p/ a tela refletir o laudo real; hints e rótulos revisados. Frontend cumulativo sobre base v118.


> **v124 (Claude):** FIX do bloqueio de pop-up na emissão de laudo + otimização da EF. `src/lib/pdf.ts`: a aba síncrona deixa de usar `noopener` (com noopener o window.open('') retornava null e o truque falhava) → agora segura a aba de verdade, mostra tela de loading e **cai em download automático** se a aba for bloqueada. EF `generate-laudo-ensaio-pdf` v18 (ezbr 92174d0…): auth+concretagem+gate e o lote de metadados (incl. moldador) em paralelo. Pacote segue CUMULATIVO ondas 1-4 sobre base v118.


> **RENUMERADO v122→v123 (Claude):** v122 já era a Onda 3. Pacote CUMULATIVO Ondas 1+2+3+4 (timeline + matriz/gate + RBAC/deleg/segconta + broadcast/backlog/webhooks) sobre base v118. Backend 093–106 aplicado via MCP. EFs: generate-laudo-ensaio-pdf v17 (gate) + auth-password-hook v1 + dispatch-outgoing-webhooks v1 (ambos opcionais/inertes até config manual).


## v125 — Onda 4 GeoCon port: comunicados com ciência + backlog interno + webhooks/API — FE + backend separado
Entrega `/gestao/comunicados`, `/gestao/backlog` e `/gestao/webhooks`. Backend separado: migrations 101–103 criam broadcast com confirmação de ciência, backlog admin-only, webhooks assinados com fila/retry e API keys hashadas. Inclui EF `dispatch-outgoing-webhooks` (verify_jwt=false, CRON_SECRET). Base: v121/Onda 3. Aplicar depois das migrations 093–100 das ondas anteriores.

# GEOLAB → Concresoft — SOURCE VERSION v121
CACHE_NAME: consultegeo-geolab-v121 · APP_VERSION: v121

## v121 — Onda 3 GeoCon port: RBAC granular + delegações + segurança da conta — FE + backend separado
Entrega as telas `/gestao/rbac`, `/gestao/delegacoes` e `/gestao/seguranca-conta`. Backend separado: migrations 098–100 criam catálogo de permissões, matriz papel×permissão, helpers `member_has_permission`/`current_has_permission`, delegações temporárias de aprovação e trilha de login/tentativas de senha. Base: v120/Onda 2. Aplicar depois das migrations 095–097 da Onda 2.

# GEOLAB → Concresoft — SOURCE VERSION v120
CACHE_NAME: consultegeo-geolab-v120 · APP_VERSION: v120

## v120 — Onda 2 GeoCon port: matriz documental + gate de laudo — FE + backend separado
Entrega a tela `/gestao/documentos` para conformidade documental e pré-checagem de emissão de laudo. O backend separado contém as migrations 095–097 para tipos/requisitos/documentos, visão `v_lab_document_conformity`, RPCs `list_docgate_conformity`, `docgate_laudo_blocks`, `can_emit_lab_report` e `assert_can_emit_lab_report`, além do patch da EF `generate-laudo-ensaio-pdf` para bloquear emissão com pendências técnicas. Base: v119/Onda 1.

# GEOLAB → Concresoft — SOURCE VERSION v119
CACHE_NAME: consultegeo-geolab-v119 · APP_VERSION: v119

## v119 — Onda 1 GeoCon→GEOLAB: auditoria genérica + linha do tempo
Porta a fundação regulatória do GeoCon para o domínio do laboratório. Backend separado: migrations 093/094 criam `audit_log`, `audit_row_change()` e RPCs `list_tenant_timeline`, `list_work_timeline` e `list_concretagem_timeline` com marcos de domínio. Frontend: nova tela `/gestao/timeline`, API `timeline.ts`, navegação e busca global. Build esperado: check-source · biome · tsc · vitest · vite. Aplicação do backend via Claude/MCP antes de liberar a tela em produção.


> **RECONCILIAÇÃO (29/06):** este arquivo vinha **stale em v111** no zip (gotcha do pipeline; REL-002 da auditoria). Cabeçalho reconciliado para **v118**. Resumo v112→v117: `pdf.ts` (v112) · e-mail A2/A4/A5/A10/A11/A12 (v113→v115) · NC-RAC (v116) · Central cockpit + RPC paginado de concretagens/migration 088 (v117). Banco vivo em **migrations 001→091**, **35 EFs**, 22 crons.

> **v118 — pós-auditoria GPT Pro (validada/adaptada por Claude):** backend via MCP — **089** REVOKE EXECUTE em 22 funções SECURITY DEFINER (NC/triggers e portal/magic-link sem `anon`; 4 de EF viram service-role-only); **090** deny-policies em `client_telemetry_rate_limit`/`frontend_canary_checks` (advisor rls_no_policy zerado); **091** 8 índices compostos enxutos (descartadas ~30 duplicatas/redundâncias da proposta). Frontend: a11y do `VirtualTable` (header sortable → `<button>` + reset CSS `.vt-th`) e import morto removido em `EmailLogPage`. Pendente manual: leaked-password protection (Supabase Auth). SW `fetch` handler mantido (remoção não solicitada/arriscada).

## v111 — Gestão de e-mails A9: catálogo de eventos + rótulos amigáveis — FE-only
`EmailLogPage` (/gestao/emails): usa `notification_event_types` (RLS de leitura = todos) para mostrar **rótulos
amigáveis** (`descricao`) no lugar das keys cruas, no **outbox**, no **histórico** e no **detalhe** (com a key como
tooltip e fallback quando o evento não está catalogado, ex. `digest_nc`/`system`). O detalhe ganhou **categoria** e
**severidade**. Novo card **Catálogo de eventos** (referência): descrição, código, categoria, severidade, canal
padrão e flags (sistema/digest/inativo). Sem backend — `emails.ts` ganhou `listEventTypes`/`EventType`. Build verde.
Detalhes em `docs/CHANGELOG-v111.md`. Quarto item do `docs/BACKLOG-FRONTEND-EMAILS.md` (A1=v108, A6=v109, A7=v110).

## v110 — Gestão de e-mails A7: editor de allowlist — FE-only
`EmailLogPage` (/gestao/emails), no card de modo: editor da **allowlist** de envio real. Mostra os endereços como
chips, permite **adicionar** (e-mail normalizado lower/trim, dedupe), **remover** por chip e **Liberar todos**
(esvaziar = todos recebem) com confirmação. Deixa explícita a semântica: **vazia = todos recebem; com endereços =
só eles** em envio real. Sem backend — `saveDispatchSettings` já aceitava `email_allowlist` (grava `null` quando
esvaziada). Edição restrita a `podeEditar` (admin/admin_consulte), como os toggles. Build verde.
Detalhes em `docs/CHANGELOG-v110.md`. Terceiro item do `docs/BACKLOG-FRONTEND-EMAILS.md` (A1=v108, A6=v109).

## v109 — Gestão de e-mails A6: gerenciar supressões — FE + 2 RPCs de escrita
`EmailLogPage` (/gestao/emails) ganha um card **Supressões de e-mail** (restrito a `admin_consulte`, que é quem a
RLS deixa ler): lista e-mails bloqueados (bounce/reclamação/manual) com motivo e data, **formulário para adicionar**
supressão manual e **remover** (reabilitar) por linha, com confirmação. Escrita via 2 RPCs (migration **085**)
`email_suppression_add`/`email_suppression_remove`, `SECURITY DEFINER` + `search_path=public`, autorizadas por
`has_role('admin_consulte')` (espelha a policy de SELECT; trava verificada — contexto não-membro recebe
`not authorized`), `grant` só a `authenticated`. `emails.ts` ganhou `listSuppressions`/`addSuppression`/
`removeSuppression`. Build verde. Detalhes em `docs/CHANGELOG-v109.md`. Segundo item entregue do
`docs/BACKLOG-FRONTEND-EMAILS.md` (após A1=v108).

## v108 — Gestão de e-mails A1: detalhe por destinatário (drill-down) — FE-only
`EmailLogPage` (/gestao/emails): clicar numa linha do histórico abre um painel com a **escada de ciclo de vida**
(enviado → entregue → aberto → clicado → bounce/reclamação) com timestamps, nº de aberturas/cliques, último link
clicado, user-agent, resend_id, dedupe, entidade de origem, erro/motivo e metadata. Sem backend: os campos já
existiam em `notification_dispatch_log`; ampliei o `select` de `emails.ts` (+ notification_type, dedupe_key,
last_clicked_url, last_user_agent, updated_at) e a UI usa a própria linha (sem query extra). Build verde.
Detalhes em `docs/CHANGELOG-v108.md`. Primeiro item do `docs/BACKLOG-FRONTEND-EMAILS.md`.

## v107 — KPIs do painel agregados no banco (item E) — FE + 1 RPC de leitura
Fecha o item **E**: `getKpis` deixa de baixar agenda+laudos+equipamentos e contar no cliente; passa a chamar a RPC
**`dashboard_kpis(p_tenant)`** (8 contadores agregados em 1 ida-e-volta). `SECURITY DEFINER` + `search_path=public`,
autorizada por **`is_tenant_member(p_tenant)`** (não-membro ⇒ zeros), `grant` só a `authenticated`. Migration **084**.
Reproduz exatamente os números anteriores (piloto: agenda 6/0/96/102 · laudos 0/2/2 · calibrações 0). `dashboard.ts`
perde o import órfão de `listAgenda` (que segue em uso na tela de Rompimentos). Build verde. Detalhes em
`docs/CHANGELOG-v107.md`.
> Numeração: itens 1+2 sairam como **v106** numa sessão paralela; este item E é **v107** (como aquela sessão previu).

## v106 — Itens 1+2: doc de reconciliação + "insatisfatório" na idade de controle
**FE quase idêntico ao v105** (muda 1 bloco em `RompimentosPage` + arquivos de versão). **Migration 083**
(mesma RPC `rompimentos_resumo`, só a regra do `insatisfatorio`). Item 1: `docs/VERSOES-RECONCILIACAO.md`
atualizado (lineage v103→v106). Item 2: "insatisfatório" deixa de contar abaixo do fck em qualquer idade e passa
a contar **só na idade de controle** (`config_lab.idade_controle_default`, exceto horas) — alinhando as **3
superfícies**: badge/RPC, filtro "Mostrar Apenas Insatisfatórios" (`RompimentosPage`) e destaque de linha (que já
era idade de controle). No piloto: badge 86 → **4**. Build verde. Detalhes em `docs/CHANGELOG-v106.md`.
> Item 3 (KPIs do dashboard como agregado no banco) está **preparado e aguardando OK** para aplicar a DDL — vira v107.

## v105 — Paginação server-side nas listas que crescem (item C completo) — FE + 1 RPC de leitura
Consolida as **3 fatias** de paginação/escala das listagens. **1 migration** (apenas uma função de leitura;
não altera tabelas nem dados): `rompimentos_resumo(p_tenant)` — `SECURITY DEFINER` + `search_path=public`,
autorizada por **`is_tenant_member(p_tenant)`** (espelha o RLS; não-membro ⇒ zeros), `grant` só a `authenticated`.
**Fatia 1 — `NcPage`:** `listNcs` agora pagina no servidor (`.range()` + `count:'exact'`, retorna `{rows,total}`);
25/pág, Anterior/Próxima, `keepPreviousData`, reset ao trocar filtros (que já eram server-side). **Fatia 2 —
`ConcretagensPage`/`LaudosPage`:** novas `listConcretagensPaged`/`listLaudosPaged` (busca server-side por `ilike`
nas colunas-base + filtros `.eq` de cliente/obra + `.range()` + count); a busca livre por **nome** de cliente/obra
(que cruzava tabelas juntadas) virou **dropdown server-side** — mesma capacidade, agora escalável; `listConcretagens`/
`listProgramacoes`/`listLaudos` seguem intactas. **Fatia 3 — `RompimentosPage`:** a grade busca **só pendentes por
padrão** (escala) e **tudo** quando "Mostrar Lançados/Insatisfatórios" está ligado; os 4 contadores
(pendente/atrasado/rompido/insatisfatório) vêm da RPC (globais, independem do recorte carregado); colar/selecionar/
salvar **inalterados**. Build verde ponta-a-ponta (check-source · biome · tsc · vitest 18/18 · vite).
Detalhes em `docs/CHANGELOG-v105.md`.
> Notas de comportamento: em Rompimentos, "insatisfatório" no badge usa a **idade de controle** (migration 083,
> a pedido — alinhado ao destaque de linha da grade; passou de 86 p/ 4 no piloto) e "atrasado" é **global "até
> hoje"** (independe da Data de Referência da grade).
> Reconciliar a numeração v103/v104 (sessão paralela) quando puder.

## v104 — Performance (passe 2, sobre o v103) + validação de upload — FE-only
Soma à trilha de performance do **v103** (passe paralelo: filtro server-side em `listAgenda`/`listCpsRompimento`,
`getKpis(tenantId?)`, cache key do painel). **Nenhuma** migration/EF/mudança de banco; o bump marca o release.
A auditoria desta sessão (relatório `RELATORIO-PERFORMANCE-GEOLAB.md`, tudo medido: `pg_stat_statements`,
telemetria, bundle real) **confirma o v103**: no volume atual (piloto, maior tabela ~260 linhas) nenhuma query de
app está lenta — ganhos **preventivos**. **Performance (net-novo sobre o v103):** **(1)** `getKpis` resolve as 3
leituras com `Promise.all` (1 ida-e-volta em vez de 3; por cima do threading de tenant do v103); **(2)** filtro
`tenant_id` em `listConcretagensComResultado` (`material_tests`) e `listConcretagensComPendentes` (`corpos_prova`)
+ threading nos call sites (`LaudosPage`/`ImportacoesPage` passam `member.tenant_id` e incluem o tenant na
queryKey) — fecha as leituras quentes que o v103 não cobriu; **(3)** `staleTime` 5 min nos dropdowns de referência
(`AdminListPage`). **Upload:** novo `src/lib/upload.ts` (`assertUploadSize` 15 MB + `assertImagem`) aplicado em foto
de evidência (`uploadEvidencia`), OCR de NF/ficha (`fileToBase64`) e anexo de NC (`uploadAnexo`, tipo livre p/
PDF/doc); o anexo do portal mantém os 8 MB próprios. Build verde ponta-a-ponta (check-source · biome · tsc ·
vitest 18/18 · vite). Detalhes em `docs/CHANGELOG-v104.md`.
> **Colisão de numeração:** o **v103** foi cortado por uma **sessão paralela** (perf do dashboard/rompimentos), com
> seu próprio `docs/CHANGELOG-v103.md`. Esta sessão numerou **v104** (próximo livre) — **reconciliar a lineage**
> depois. Os relatórios `docs/PERF-*` citados pelo v103 **não estão nesta árvore** (ficaram na saída da outra
> sessão). Fora do release, **precisam de decisão**: paginação server-side nas listas (C, muda UX) e KPIs como
> agregado no banco (E, DDL em produção). Não dropar índices agora (prematuro).

## v103 — Performance: escopo de tenant + filtro server-side no caminho do dashboard (FE-only)
Fruto da **auditoria de performance** (relatórios em `docs/PERF-*`). **Nenhuma** migration/EF/mudança de banco;
só frontend. Conclusão da auditoria: no volume atual (banco ~18 MB; maiores tabelas com centenas de linhas)
**nenhuma query de aplicação está lenta** (medido via `pg_stat_statements`); os ganhos são **estruturais/preventivos**.
Mudanças **seguras e que preservam o resultado**: **(1)** `listAgenda(tenantId?)` filtra `situacao='pendente'` **no
servidor** (antes: fetch completo + filtro em JS) e aceita escopo de tenant explícito; **(2)** `getKpis(tenantId?)`
repassa o tenant; **(3)** `DashboardPage` usa `queryKey:['kpis', tenant_id]` e passa o tenant — corrige **isolamento
de cache multi-tenant** (as demais telas já incluíam o tenant na key) e fecha a única leitura quente que dependia só
de RLS (Rompimentos/Concretagens já passavam `tenant_id`). Build verde ponta-a-ponta (check-source · biome · tsc ·
vitest 18/18 · vite).
> Por que importa à escala: a RLS de SELECT é `is_tenant_member(tenant_id)` (STABLE, **não-sargável**) — sem
> `tenant_id = <const>` explícito o planner faz seq scan + filtro por linha. O filtro explícito (inócuo em resultado,
> pois a RLS já restringe) torna o predicado sargável e habilita índice à escala. **Recomendado (NÃO aplicado):**
> índice composto `corpos_prova(tenant_id, situacao, data_prevista_rompimento) WHERE deleted_at IS NULL` quando a
> tabela crescer; limpeza dos ~267 índices nunca usados (só ~3 MB hoje — baixa urgência; script opcional em
> `docs/PERF-INDICES-*`); paginação/limite em combos e contagem `estimated` em listas grandes.

## v102 — UX/UI: confirmações, mobile do VirtualTable, a11y de campos e StatusBadge (FE-only)
Consolida **4 lotes de UX** da auditoria (`AUDITORIA-UXUI-GEOLAB.md`). **Nenhuma** migration/EF/mudança de
banco — só frontend; o bump de APP_VERSION/cache marca o release. **L1 — confirmações + texto:** `useConfirm`
(já existente) em **10 ações** consequentes/irreversíveis (aprovar laudo por link, emitir/reabrir laudo,
cancelar programação, remover estrutura, fechar medição, ativar envio real de e-mail, desativar usuário,
revogar link/desativar cliente) + correção do texto **falso** "dry-run/simulação" da `NotificacoesPage`
(despacho está ATIVO; fonte de verdade = Sistema › E-mails). **L2 — mobile:** `VirtualTable` ganha
**modo-cartão** (`md:hidden`) espelhando o `DataTable` (hoje beneficia a `ProgramacoesPage`; API inalterada).
**L3 — a11y (T1):** `Field/TextArea/SelectField` ligam erro/dica por **`aria-describedby`** + **ícone** no erro
(não-só-cor). **L4 — StatusBadge:** vocabulário central `recordStatusMeta` estendido (lote/laudo/financeiro/
medição) e **cor-crua trocada por `<StatusBadge>`** em Programações/Lotes/NC(status)/Faturas/Medição/Concretagens.
Build `npm run build` **verde** ponta-a-ponta (check-source · biome · tsc · vitest 18/18 · vite). Detalhes em
`docs/CHANGELOG-v102.md`.
> Fora do lote (de propósito): validade-de-certificação da `ColaboradoresPage` e **severidade** da NC
> (vocabulários próprios); tabelas bespoke `Rompimentos`/`Lotes`/`Nc` (mobile) seguem pendentes. O T1 só
> "ativa" quando os formulários passarem `error`. **Não** altera backend nem a pendência de dedupe (resolvida no v101).
> **Repo:** removido o diretório da EF `cron-watchdog` (aposentada/no-op desde v101, desagendada na 080); o slug
> em produção é deletado fora do MCP via `supabase functions delete cron-watchdog`.

## v101 — Backend: correção da colisão de dedupe + cobertura de calibração vencida
Release rotulado costurando 2 mudanças de backend aplicadas em produção via MCP (27/06). **FE = v100
inalterado**; bump de APP_VERSION/cache só marca o release. **080** desagenda o `cron-watchdog` (legado)
que duplicava `cp_atrasado`/`calibracao_vencendo` (incidente VIVO — dispatch ligado; log de 27/06 com 2×
por CP). Reversível; EF cron-watchdog neutralizada (v8, no-op). **081** amplia `notify_scan_calibracao` para incluir calibrações
**já vencidas** (remove piso de data; dedupe inalterada; texto "venceu há N dias" vs "vence em N dias"),
fechando o gap da 080 — verificado 0 vencidas no momento (sem rajada). Líquido: 1 e-mail por CP vencido
(via NC T-10/28D) e 1 por equipamento (a vencer + vencidas). Detalhes em `docs/CHANGELOG-v101.md` e
`docs/CHANGELOG-hotfix-dedupe-watchdog.md`.
> Efeitos de escopo da 080: `cp_atrasado` agora só 28D (via NC); calibração coberta de novo pela 081.
> EF cron-watchdog neutralizada (v8, no-op). Remover slug (opcional): supabase functions delete cron-watchdog.

## v100 — Observabilidade: incidentes investigáveis + sparkline por Edge Function — só frontend
Reescrita incremental de **`src/pages/gestao/ObservabilidadePage.tsx`** (mantém tudo da v99). **Nenhuma**
migration/EF/mudança de banco — leitura sobre colunas/views que já existem (conferido via MCP read-only).
**(1) Incidentes investigáveis:** alternância **Abertos | Resolvidos (7d)** (query de resolvidos por
`status='resolved'` + `resolved_at`, `enabled` só ao abrir a aba), coluna **“Durou” (TTR = resolved_at −
first_seen_at)**, e filtros client-side **gravidade / família / “só não notificados”** (combine crítico +
não-notificado p/ isolar e-mails que não saíram) + contador “X de Y” e estados vazios distintos.
**(2) Sparkline 24h por Edge Function:** a query de EF passou a trazer a série horária bruta das 24h e a
tela deriva, por função, a última hora (números) + mini-tendência de chamadas/h numa coluna “24h” — sem
query extra (mesma `v_ef_metrics_hourly`, agrupada no cliente). Removido helper `latestPerKey` (sem uso).
Bump `APP_VERSION v99→v100` e `CACHE_NAME …-v100`. Build verde ponta-a-ponta
(check-source · biome · tsc 0 erros · vitest 18/18 · vite). Detalhes em `docs/CHANGELOG-v100.md`.
> Banner/KPIs seguem sobre os abertos (alternar p/ resolvidos não mexe no topo). Numeração provisória
> (FE-only sobre a v99). NÃO altera a pendência de dedupe `cron-watchdog` × scans (074/072) da v98.

## v99 — Melhorias de front na Observabilidade (telemetria) — só frontend
Reescrita incremental de **`src/pages/gestao/ObservabilidadePage.tsx`** (mantém todas as seções/dados
anteriores). **Nenhuma** migration/EF/mudança de banco — toda leitura usa colunas/views que já existem em
produção (conferido por introspecção MCP read-only): **banner de saúde** (críticos abertos · críticos
**não notificados** · runners atrasados · avisos), **coluna “Notificação”** nos incidentes via
`telemetry_alert.notified_at` (once-per-incident da 076), **card “Runners de alarme & notificação”** que
isola o plano de controle da telemetria (`telemetry-alarm/-pg-alarm/-email-alarm/-release-alarm/-ops-alarm/-notify`)
dos demais jobs — payoff do heartbeat-decouple da **077** (runner travado fica óbvio), **chip de família**
por `kind` (Frontend/Release/E-mail/Ops/Agenda/Banco/Edge Fn — namespaces disjuntos), **KPIs com cor** + novo
KPI “Críticos não notificados”, **estado “ao vivo” + botão Atualizar** (refetch geral) e **barra inline de
crash-free**. Bump `APP_VERSION v98→v99` e `CACHE_NAME …-v99`. Build verde ponta-a-ponta
(check-source · biome · tsc 0 erros · vitest 18/18 · vite). Detalhes em `docs/CHANGELOG-v99.md`.
> Numeração: a v98 reconstruiu o fonte vivo (3 trilhas + 2 telas). Esta é uma melhoria de FE **nova** (não
> está no vivo), por isso recebe v99 — mantém a história da v98 honesta. Patch = 1 arquivo de página + bumps.
> NÃO altera a pendência de dedupe `cron-watchdog` × scans (074/072) da v98 (backend, segue em aberto).

## v98 — Reconstrução do fonte das 3 trilhas vivas (backup/e-mail/telemetria) + 2 telas admin
As trilhas de **Backup**, **E-mail (dispatcher + quiet-hours)** e **Telemetria (ops + heartbeat)** já estavam **vivas
na produção** (aplicadas via MCP numa sessão anterior, **sem fonte preservado**). A v98 **reconstrói o fonte
byte-a-byte** do vivo e o integra: **7 migrations 071–077** (md5 conferido; `pglast` OK), **9 Edge Functions**
(8 novas + `telemetry-alarm` v5 sobrescrita; `esbuild` OK; `verify_jwt=false` no `config.toml`) e **2 telas admin**
(`/gestao/backups` e `/gestao/emails`) que leem `backup_log`/`cron_heartbeat` e `notification_dispatch_log`/
`notification_dispatch_settings`/`notify_event_outbox` (sempre com `tenant_id` explícito; nunca expõe `dispatch_secret`).
Nada a reaplicar no banco — já está live; este pacote alinha o repo ao vivo e leva o frontend novo ao próximo deploy.
Build `npm run build` **verde** ponta-a-ponta (check-source · biome · tsc · vitest 18/18 · vite). Detalhes/ordem/segredos/
cron + pendências em **`docs/CHANGELOG-v98.md`**.
> ⚠️ **2 pontos a decidir/saber:** (1) `cron-watchdog` v7 colide nas dedupe keys de `cp_atrasado`/`calibracao_vencendo`
> com os scans 074/072 (duplicata latente — resolver antes de ligar o envio real; hoje `dispatch_enabled=false`/`dry_run=true`).
> (2) Corrigido um **build-blocker pré-existente** do v97: `biome` (2.5.1) reprovava `src/lib/export/xlsx.ts` por
> caractere de controle em regex — troca de 1 linha por equivalente `/[\u0080-\uffff]/g` (sem mudança de comportamento).
> ⚠️ **Dependência:** a 072 usa o núcleo de notificação criado em **065–070**, que **não** está nesta pasta (espelho
> parcial — pré-existente). Em produção existe; num banco zerado, 065–070 são pré-requisito.

## v93 — Helper único de exportação Excel (Concresoft) + consolida v88 (laudo)
Padrão ÚNICO e de marca para TODAS as exportações .xlsx do sistema. Nova lib **xlsx-js-style** (fork do SheetJS com
estilos de célula; o `xlsx` puro não estiliza) + **`src/lib/export/xlsx.ts`** — `exportExcel(meta, sheets)` genérico:
banda Concresoft (navy) + título + metadados (laboratório/período/filtros/gerado em/registros) + tabela estilizada
(cabeçalho navy, zebra, bordas, formatos BR int/dec/money/percent/date, autofiltro) + linha de TOTAL opcional; modo
`template` (cabeçalho na linha 1, sem banda) p/ modelos reimportáveis. Migrados os 4 exports: portal de resultados
(2 abas), medição, produtividade e modelo de rompimentos (template, round-trip preservado). DS em GEOLAB-Export-Excel-DS.md.
Sem migration/EF. **Consolida o v88** (revisão do laudo NBR 5739 + toggle `aceitacao`) no mesmo push.
> NUMERAÇÃO contestada: sessões paralelas avançaram até v92 (não estão na pasta). Numerei **v93** (próx. livre documentado); o nº é provisório — defina na reconciliação. Deltas cirúrgicos → cherry-pick sobre o HEAD atual.

## v88 — Revisão tipográfica do laudo (EF) + toggle de aceitação (FE)
Revisão do modelo de laudo NBR 5739. **EF `generate-laudo-ensaio-pdf` v15 (sha 3242a328) JÁ LIVE via MCP** (independe deste push):
acentuação PT-BR completa (Relatório, Resistência à compressão, EMISSÃO, ENDEREÇO, Traço, Lançamento, Câmara úmida, Comentários e observações, Validação pública, Página…), `m³`/`kg/m³`, `°C`, `Nº`, `±`, `×`; **barra de aceitação em 2 linhas** (corrige a sobreposição "condição A / fck,est"); horários **HH:MM**; `san()` endurecido. **Novo toggle `aceitacao`** (default ON) some com a faixa de aceitação; `recebimento` (já existente) some com o bloco de caminhões.
**Delta de FRONTEND = 1 arquivo:** `src/lib/concreto/camposEnsaioLaudo.ts` ganha a seção "Bloco de aceitação" em CAMPOS_LAUDO (aparece em /gestao/controle-laudo ▸ Seções do laudo). Sem migration/RLS. Bump v88.
> **ATENÇÃO numeração/base:** esta árvore parte do source **v83** (o mais recente NA PASTA do projeto). A memória indica v84–v87 já feitos (portal/comentários/NF-OCR) cujos fontes NÃO estão na pasta. Por isso numerei **v88** (próximo livre) e o patch é **cherry-pick de 1 arquivo** — aplicar sobre o HEAD atual do repo. `camposEnsaioLaudo.ts` não foi tocado em v84–v87, então o cherry-pick é seguro.

## v83 — RELEASE CONSOLIDADO (portal + ficha) — substitui v80/v81/v82 num push só
Consolida portal em abas/Parcial-Final/Excel (era v80), 12 melhorias do portal (era v81) e ficha de moldagem
Modelo A + OCR (era v82) em um único release, resolvendo as colisões de numeração. Backend já LIVE via MCP:
migrations 063+064; EFs lab-client-portal v9, portal-anexo v1, generate-ficha-moldagem-pdf v12 (Modelo A),
extract-ficha-vision v4. check-source OK; revisões independentes SHIP. Detalhe dos arquivos em INSTRUCOES.md.


## v82 — Ficha de moldagem Modelo A (em branco + pré-preenchida) + OCR alinhado
EF `generate-ficha-moldagem-pdf` **v12** (sha 846fadcf) reescrita para o Modelo A paisagem; modos em branco (`{mode:'blank'}`) e pré-preenchida (`{concretagem_id}` + QR). EF `extract-ficha-vision` **v4** (sha fcf31a6e) com prompt do OCR alinhado às colunas do Modelo A. Frontend: `invokeFichaBranco()` + botão "Ficha em branco (PDF)" na Central de Concretagens; o resto do fluxo (Gerar ficha, Ler ficha preenchida→OCR→conferência→addCaminhao) já existia. Local: Concreto ▸ Concretagens (central + detalhe). Gate: check-source OK; revisão independente SHIP (EF conferido numericamente). 3 modelos de ficha em branco (A/B/C) também entregues como PDF.


## v81 — 12 melhorias do portal do cliente (em ordem de prioridade)
Sobre o v80 (portal em abas + Parcial/Final + Excel). Itens: (1) curva de evolução por exemplar; (2) alerta de CP atrasado; (3) selo Parcial/Final na LaudosPage staff + auto enviar-laudo-cliente ao emitir laudo Final; (4) painel-resumo (cards); (5) filtro por período; (6) export PDF (print do navegador); (7) StatusBadge na programação; (8) anexo NF/DANFE na programação (EF portal-anexo); (9) gestão de magic links (último acesso + revogar); (10) ARIA nas abas; (11) paginação; (12) toggle de detalhes técnicos.
- **Banco (APLICADO via MCP — migration 064):** laudos_parcial_final() (staff), magic_links.last_access_at/access_count, bump_magic_link_access(), revogar_magic_link(), listar_magic_links_portal().
- **EFs (DEPLOYADAS via MCP):** lab-client-portal **v9** (sha dfe2b8b1, marca acesso); **portal-anexo v1** (sha 2d65bdeb, verify_jwt=true, upload/download no bucket anexos).
- **Gate:** check-source OK; revisão independente SHIP (0 must-fix). tsc/biome/vitest no Netlify CI.


## v80 — Portal do cliente: abas, filtros, Parcial/Final, resultados inline, Excel
Separação Programação × Resultados&Laudos em **abas** no `/portal-cliente`. Aba Resultados: filtros (obra, busca, tipo Parcial/Final, status, idade, conformidade), **selo Parcial/Final por exemplar** (Final = todos os exemplares com idade de controle), botão **Ver resultados** inline (sem baixar o PDF) e **Exportar Excel** (Resumo por exemplar + Detalhe por CP) respeitando o filtro. Paridade no portal **magic link**: página pública `/portal/acesso/:token` reusando os componentes + ação staff "Gerar link do portal".
- **Banco (APLICADO via MCP — migration 063):** fn_resultados_por_obras / fn_laudos_por_obras (núcleo SECURITY DEFINER, service_role) + portal_resultados / portal_laudos (wrappers escopados por member_can_access_work, grant authenticated). Cliente não lê corpos_prova/material_tests/laudo_resultados (is_tenant_member exclui 'cliente').
- **EF (DEPLOYADA via MCP):** lab-client-portal v8 (sha b9c4035d…) — devolve resultados + laudos com parcial_final. Self-contained.
- **Gate:** check-source OK. tsc/biome/vitest no Netlify CI. Revisão independente: SHIP, 0 must-fix.


## v78 — Revisão dos ícones do menu lateral
Concretagens→caminhão betoneira; Rompimentos→prensa de compressão; Preferências→engrenagem; Medição→régua; Faturas→recibo; Fôrmas→molde cilíndrico; Usuários de clientes→pessoas; Config de NC→sliders. Resolve colisões de ícone (FileText/Boxes/Building2/Gauge). Apenas src/components/ui/icons.tsx (novos SVG) + src/components/Layout.tsx (mapeamento) — sem banco/EF/rota/lógica; Truck/Flame seguem exportados. Gate verde: check-source / biome (0 erros) / tsc --noEmit / vitest 18.

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
