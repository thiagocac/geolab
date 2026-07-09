# GEOLAB — v203 — instruções de aplicação

Release **frontend puro**. Sem migration, sem Edge Function. `CACHE_NAME` + `APP_VERSION` bumpados juntos para **v203**.

## O que muda — Padrão de moldagem na Nova Programação
Na tela **Nova programação** (`/programacoes/nova`), o padrão de moldagem sai do bloco inline e passa a um **botão "Padrão de moldagem"** que abre o editor em **modal**. A semente (default) segue estas regras:

- **Primeira concretagem** (nenhuma cadastrada ainda no sistema): abre com **2 CP de 28 dias**.
- **Com concretagens já cadastradas**: a semente é o **padrão de moldagem da última concretagem cadastrada** no laboratório (a mais recente por `created_at`). Como cada programação salva vira "a última", a **próxima** programação já abre com o mesmo padrão da anterior — sem redigitar.
- **Traço cadastrado selecionado**: o padrão do traço prevalece (herdado). Voltar para "Manual" volta a semear pela última concretagem.
- O usuário pode ajustar tudo no modal; a lista fica sempre ordenada da menor idade para a maior e o valor esperado é calculado do FCK.

O card mostra um **resumo** do padrão atual (ex.: `2×28d  (2 CP)`) e a origem da sugestão.

## Arquivos alterados (patches)
- src/lib/api/concretagem.ts        (nova função `ultimoPadraoMoldagem(tenantId)`)
- src/pages/concreto/NovaProgramacaoPage.tsx  (botão + modal + semente da última concretagem; fallback 2×28d)
- src/lib/telemetry/core.ts         (APP_VERSION = v203)
- public/sw.js                      (CACHE_NAME = consultegeo-geolab-v203)

## Como aplicar
Copiar estes arquivos por cima da árvore atual (mesmos caminhos) e dar push (GitHub → Netlify CI builda).

## Gate local (espelho do Netlify)
check-source OK · biome lint 0 · vitest 23/23 · vite build OK. `tsc --noEmit` roda no Netlify CI.
