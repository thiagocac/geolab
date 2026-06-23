# GEOLAB — Patch v28 (integração GEOMAT: rompimentos + controle-laudo + traços)

Integração avaliada e mesclada do fork GPT/Claude no nosso tronco v27 (preservando
Estrutura, Colaboradores, validação pública, numeração, logo e os 10 EFs).

## Backend já aplicado (via MCP)
- **Migration `027`** (era 023 no fork) — `corpos_prova.numeracao_lab`, índices, RPCs
  `lancar_rompimento_cp` (calcula MPa no banco, re-lançamento c/ substitui_resultado_id,
  trilha em metadata.rompimento_log), `lancar_situacao_cp` (Falha/Ausente/Descarte),
  `gerar_contraprova_cp`, `set_numeracao_cp`; defaults de ensaio_campos/laudo_campos.
- **Migration `028`** — revoga execute das RPCs de anon/public (gate = authenticated + is_tenant_writer).

## Frontend (mesclado)
| Arquivo | Origem |
|---|---|
| `src/lib/concreto/cp.ts`, `camposEnsaioLaudo.ts`, `src/lib/concreto.ts` | NOVOS (fork) — cálculo CP + catálogo de campos |
| `src/lib/api/rompimento.ts` | fork (superset: RPCs + fallback + maybeNotifyAbaixoFck) |
| `src/pages/concreto/RompimentosPage.tsx` | fork — **tela estilo GEOMAT `/concreto/controle/resultados`** (sem Portal): filtros, lote/linha, carga→MPa, badges, XLSX, trilha, contraprova, numeração lab |
| `src/pages/gestao/ControleLaudoPage.tsx` | NOVO (fork) — Campos do ensaio e do laudo (dinâmico, salva em config_lab) |
| `src/pages/cadastros/MateriaisPage.tsx` + `materiais.ts` | fork — traços ricos estilo Nova obra GEOMAT (chips, padrão de moldagem) |
| `src/lib/api/preferencias.ts` | MESCLADO — meu (logo) + `ensaio_campos` |
| `src/App.tsx`, `Layout.tsx` | MESCLADO — rotas `/tracos` e `/gestao/controle-laudo` + nav |

## Mantido NOSSO (não veio do fork)
concretagem.ts (superset c/ listPecasObra), importacao.ts, Estrutura, Colaboradores+certificações,
ValidarPage, logo upload, numeração de concretagem.

## PENDENTE (próximo passo, via MCP)
Deploy do **laudo EF v4** (linguagem NBR 12655 · fck,est) e do **generate-agenda-rompimento-pdf**.
Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
