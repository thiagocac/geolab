# Reconciliação de versões — v103 / v104 / v105 / v106

Este documento esclarece a **lineage** das versões recentes, porque houve uma **colisão de numeração** entre
sessões paralelas que compartilharam o mesmo repositório. Não há mudança de código aqui — é só organização.

## O que aconteceu
- O **v103** foi cortado por uma **sessão paralela** (não esta), focada em performance do dashboard/rompimentos.
  Ele já estava na árvore (APP_VERSION/cache/SOURCE_VERSION em v103, com `docs/CHANGELOG-v103.md`) quando esta
  sessão foi bumpar.
- Esta sessão **não sobrescreveu** o v103. Numerou as próprias adições como **v104** e **v105** (próximos livres),
  conforme o padrão do projeto para colisão ("numerar o próximo e reconciliar depois").

## Índice canônico (ordem real de aplicação)

| Versão | Origem | Conteúdo | Banco? |
|---|---|---|---|
| **v103** | Sessão **paralela** | Performance passe 1: `listAgenda`/`listCpsRompimento` filtram situação no servidor; `getKpis(tenantId?)` repassa tenant; cache key do `DashboardPage`. | não |
| **v104** | Esta sessão | Performance passe 2 (sobre v103): `getKpis` em `Promise.all`; filtro `tenant_id` em `listConcretagensComResultado`/`ComPendentes`; `staleTime` 5 min nos dropdowns de referência. **Validação de upload** (`src/lib/upload.ts`). | não |
| **v105** | Esta sessão | **Paginação server-side** das listas que crescem (item C completo): NC, Concretagens, Laudos, Rompimentos. **1 RPC de leitura** `rompimentos_resumo`. | sim (migration 082) |
| **v106** | Esta sessão | Itens 1+2: este doc de reconciliação + **"insatisfatório" alinhado à idade de controle** nas 3 superfícies (badge/RPC, filtro "Mostrar Apenas Insatisfatórios", destaque de linha). FE: 1 bloco em `RompimentosPage`. | sim (migration 083, mesma RPC) |

> Os relatórios `docs/PERF-RELATORIO-EXECUTIVO.md` / `docs/PERF-RELATORIO-TECNICO.md` / `docs/PERF-INDICES-*`
> citados pelo `CHANGELOG-v103.md` **não estão nesta árvore** (ficaram na saída da sessão paralela). O relatório
> de performance desta sessão é o `RELATORIO-PERFORMANCE-GEOLAB.md` (entregue à parte, fora do repo).

## Recomendação
- **Manter os números como estão** (v103 → v104 → v105). Renumerar/mesclar agora seria invasivo e arriscado sem
  ganho real. Este documento serve de índice; os `CHANGELOG-vNNN.md` detalham cada uma.
- **Próxima versão livre: v107.**
- Se quiser unificar a história, a forma segura é **só documental** (este arquivo), preservando os changelogs.

## Decisão registrada — "insatisfatório" (v106)
O badge da tela de Rompimentos contava abaixo do fck em **qualquer idade** (=86 no piloto); o destaque de linha já
usava a **idade de controle** (=4). Decidiu-se (confirmado pelo usuário) alinhar tudo à **idade de controle**:
badge/RPC (`rompimentos_resumo`, migration 083), filtro "Mostrar Apenas Insatisfatórios" e destaque passam a
significar o mesmo: abaixo do fck **na idade de controle** (`config_lab.idade_controle_default`, exceto idade em
horas). Reversível voltando a RPC e o filtro à variante "qualquer idade".

> **Convergência com sessão paralela (v106):** a outra sessão implementou o item 2 independentemente e gerou
> `083_rompimentos_resumo_idade_controle.sql` com SQL idêntico. Mantido o arquivo dela (criado primeiro); o
> duplicado desta sessão foi removido. Produção verificada (definição viva = idade de controle).

## Observação de conteúdo sobreposto
Tanto v103 (paralela) quanto v104 (esta) mexeram em `getKpis`: o v103 adicionou o threading de tenant; o v104
colocou as 3 leituras em `Promise.all` por cima. Não há conflito — são aditivos. (O texto do `CHANGELOG-v103`
diz "contagens mantidas sequenciais", o que o v104 depois alterou para paralelo; o `CHANGELOG-v104` registra isso.)
