# Patches v50 — Code-splitting por rota + xlsx sob demanda

Aplicar estes arquivos sobre o repositorio (substituindo os existentes), commitar e deixar o Netlify buildar.

## Arquivos alterados (7)
- src/App.tsx                              (lazy() + Suspense nas rotas)
- src/pages/gestao/ProdutividadePage.tsx   (import('xlsx') dinamico)
- src/pages/gestao/MedicaoPage.tsx         (import('xlsx') dinamico)
- src/pages/concreto/RompimentosPage.tsx   (import('xlsx') dinamico — exportar modelo + importar)
- src/lib/telemetry/core.ts                (APP_VERSION = 'v50')
- public/sw.js                             (CACHE_NAME = 'consultegeo-geolab-v50')
- SOURCE_VERSION.md                        (nota da release)

## O que muda
- As 27 paginas de rota carregam sob demanda (code-splitting). O bundle de entrada cai bastante.
  Cada rota baixa seu proprio chunk ao navegar.
- A lib xlsx (~143 kB gzip) sai do load inicial e so baixa quando o usuario exporta/importa planilha.
- Nenhuma mudanca visual, de backend ou de dependencias.

## Validacao ja executada (sandbox)
- node scripts/check-source.mjs  -> OK
- tsc --noEmit                   -> 0 erros
- vitest run                     -> 1/1 passou
- vite build                     -> OK; chunks separados (DashboardPage, RompimentosPage, xlsx isolado, etc.)
  Obs.: warning de "chunk > 180 kB" para supabase/xlsx e informativo (vendor/lazy) — build passa (exit 0).

## Verificar no Deploy Preview
1. Login + navegacao por todas as secoes (cada rota baixa 1 chunk — ver aba Network).
2. Abrir Rompimentos/Medicao/Produtividade e clicar Exportar -> o chunk xlsx baixa nesse momento.
3. Importar planilha em Rompimentos funciona normalmente.

Bump: este patch ja vem com APP_VERSION/CACHE_NAME = v50.
