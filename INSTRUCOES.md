# GEOLAB — v211 — instruções de aplicação

**Correção do dropdown de Peça (estrutura da obra) + Local/Peça dinâmico no Portal do cliente.** Frontend puro — sem migration, sem Edge Function. Nada a aplicar no banco nem no Supabase: subir os arquivos e deixar o Netlify CI buildar.

## O que mudou

### 1. Bug — a seleção da Peça não fixava (telas do laboratório)
Em **Concretagens › Nova Programação** (`/programacoes/nova`) e na **Etapa 1 — Concretagem** do detalhe da concretagem, o 2º dropdown do encadeado Estrutura→Peça ("Peça") era um `<select>` controlado com `value=""` fixo: ao escolher a peça o `onChange` disparava (preenchia o campo **Local/peça**), mas o próprio select voltava ao placeholder — a peça "não ficava selecionada". Corrigido no componente compartilhado **`EstruturaPecaSelect`** (usado pelas duas telas): a peça agora é guardada em estado (`pecaId`) e o `value` do select reflete a escolha; trocar a Estrutura reseta a Peça.

### 2. Portal do cliente › Programação — Local/Peça dinâmico
A célula "Local / peça" da tabela de nova programação do portal (**`PortalLocalCell`**) já buscava a estrutura da obra, mas trazia o **mesmo bug** do `value=""` no dropdown de Peça — corrigido da mesma forma. Comportamento final, por obra escolhida na linha:
- **Obra sem estrutura cadastrada:** aparece só o campo de texto livre **Local/Peça** (`Ex.: laje torre A`).
- **Obra com estrutura:** aparecem os dois dropdowns **Estrutura** + **Peça**, que preenchem o texto de Local/Peça — igual às telas do laboratório.

A estrutura criada/editada pelo cliente na aba **Estrutura da Obra** reflete automaticamente aqui: as duas telas compartilham a query `['portal-estruturas', workId]`, invalidada a cada salvar/duplicar/remover; ao voltar para a aba Programação a lista é re-buscada. EF `client-portal-estrutura` já no ar — sem alteração.

## Arquivos (aplicar sobre v210)
- `src/components/domain/EstruturaPecaSelect.tsx` — fix do dropdown de Peça (laboratório)
- `src/pages/portal/ClientePortalPage.tsx` — fix do dropdown de Peça no `PortalLocalCell` (portal)
- `src/lib/telemetry/core.ts` — `APP_VERSION = 'v211'`
- `public/sw.js` — `CACHE_NAME = 'consultegeo-geolab-v211'`

## Deploy
Pipeline único GitHub → Netlify (projeto `geo-labs`, domínio https://lab.consultegeo.org). Subir os arquivos deste zip no GitHub; o CI roda o gate (check-source → biome → tsc → vitest → vite build) e publica. Sem passos de banco/EF.

## Validação local
check-source OK · biome lint (arquivos tocados) 0 · esbuild parse OK · vite build OK. tsc/vitest ficam para o Netlify CI.

> **Linhagem:** este patch aplica sobre **v210**. Como o vivo está em v189 (v190→v211 pendente de push), na publicação use a árvore acumulada — o `source-completo-v211` é fiel e já contém tudo de v190→v211.
