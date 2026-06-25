# Patches v57 — Zod 4 (contrato schema->tipo->validacao)

Aplicar por cima da v56, commitar, deixar o Netlify buildar.
IMPORTANTE: package.json + package-lock.json mudaram (+zod). `npm ci` instala.

## Arquivos (8)
- package.json                  (+dependency zod ^4.4.3)
- package-lock.json
- src/lib/api/validar.ts        (schema Zod -> z.infer + safeParse; sai o cast `as`)
- src/lib/api/validar.test.ts   (NOVO; 3 testes do schema)
- src/lib/telemetry/core.ts     (APP_VERSION = 'v57')
- public/sw.js                  (CACHE_NAME = 'consultegeo-geolab-v57')
- SOURCE_VERSION.md / INSTRUCOES.md

## O que muda
- Estabelece o padrao Zod: o schema e a fonte unica -> tipo (z.infer) + validacao em runtime.
- Aplicado num ponto de valor e baixo risco: a EF publica validar-laudo (alvo do QR, sem login).
  Antes: `as ValidacaoLaudo` (cast sem checagem) num JSON de rede. Agora: safeParse + fallback {found:false}.
- zod entra no chunk lazy do ValidarPage (so ele usa hoje) — nao afeta o bundle principal.
- Nao refatora o resto; outros pontos (fiscal.ts, forms) migram aos poucos.

## Validacao (sandbox)
- npm run build => check-source OK · biome lint 0 erros · tsc 0 erros · vitest 4/4 (era 1) · vite build OK · EXIT 0.

## Proximos candidatos a Zod (futuro)
- fiscal.ts (resposta consulta-fiscal); payload dos forms de cadastro (junto com React Hook Form na Fase 3).

Bump: APP_VERSION/CACHE_NAME = v57.
