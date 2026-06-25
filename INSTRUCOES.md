# v75 — Cadastro de "Tipos de ensaio" (catalogo material_test_types)

> **Numeracao:** a v74 ja estava ocupada por outra release ("v74 — Correcoes da auditoria v60->v73":
> DashboardCharts lazy + handlePaste tab-safe). Para nao colidir/sobrescrever, esta entrega saiu como **v75**.
> Se preferir que a tela de Tipos de ensaio seja v74, descarte os zips v74 atuais e eu regero com bump em v74.

Adiciona a tela de cadastro do catalogo de tipos de ensaio, que faltava no frontend. Reusa o
`AdminListPage` (CRUD declarativo) — **1 arquivo de codigo alterado** + bump. **Sem migration, sem Edge Function.**

## Arquivos alterados (sobrescrever no repo)
- `src/pages/cadastros/CadastrosPage.tsx`:
  - NOVO `Tab.filter?` e nova aba **"Tipos de ensaio"** (`table: material_test_types`,
    `filter: { material_kind: 'concreto' }`), repassada ao `AdminListPage` via `filter={t.filter}`.
  - Campos: codigo*, descricao* (nome), material* (select concreto), grupo* (endurecido/fresco -> `ensaio_grupo`),
    unidade* (`unidade_resultado`), resultado consolidado* (maximo/minimo/media), idade de controle (`idade_controle`),
    ensaio padrao (`padrao`), observacao. Colunas: codigo, descricao, unidade, idade ctrl., grupo, padrao.
- `public/sw.js` + `src/lib/telemetry/core.ts` + `SOURCE_VERSION.md`: bump v75.

## Por que assim (decisoes)
- `material_test_types` ja existia (migration 006) como SUPERSET da tela equivalente do produto de origem;
  o gap era so a UI. Logo, **nada de banco**: INSERT/UPDATE direto via PostgREST sob RLS `is_tenant_writer`,
  exclusao por soft-delete (`deleted_at`).
- `material_kind` e `ensaio_grupo` entram como **fields** (nao so `filter`): o `AdminListPage` monta o payload
  do INSERT a partir dos fields e essas colunas sao NOT NULL sem default, entao precisam ir no payload.
- Colunas NOT NULL **com default** (`idade_controle_unidade='dia'`, `gera_nc=true`, `ativo=true`,
  `descarte_automatico`, `enviar_email`) ficam FORA do form para o default do banco agir (nao enviar null).

## Escopo v1 (enxuto)
- Fora da v1 (ja suportado no banco, fica para v1.1): toggle bidirecional Endurecido/Fresco no topo,
  sub-lista de "idades de e-mail" (`email_idades`), descarte automatico e gatilho de config de e-mail do contrato.

## Gate
- `node scripts/check-source.mjs` -> OK (guard CACHE_NAME==APP_VERSION==v75; sem proibicoes).
- `tsc --noEmit` / `vitest` / `vite build` no Netlify CI (mudanca e config declarativa; build verde esperado).
