# v219 — Validação de campos numéricos (anti-valores-absurdos) — Fases 2 e 3

Continuação do v218. Estende os limites a Rompimentos, Diário de cura, Padrão de moldagem
e Financeiro. Frontend puro — sem migration/EF. Reusa `src/lib/validacao.ts` + `NumField` do v218.

## Arquivos (9)
- `src/pages/concreto/RompimentosPage.tsx` — resultado/carga `maxDec` 4→2; **Diâmetro** 50–300 / **Altura** 50–600 (clamp no blur); **Massa (g)** 0–99999.
- `src/pages/gestao/DiarioCuraPage.tsx` — **Temperatura (°C)** 0–50 (step 0,1 + clamp). O aviso de faixa NBR 9479 (marca não conforme) segue intacto.
- `src/components/domain/MoldingStandardEditor.tsx` — **Idade** ≤ 999 e **Qtd CP** ≤ 99 (tetos + clamp; já tinham piso 0). Vale para Programação, Concretagem e Portal.
- `src/pages/gestao/ContratosFinanceiroPage.tsx` — **Preço unitário (R$)** ≥ 0, 2 casas (NumField).
- `src/pages/gestao/CatalogoServicosPage.tsx` — **Preço sugerido / Custo estimado (R$)** ≥ 0, 2 casas (NumField).
- `src/pages/gestao/PropostasPage.tsx` — **Quantidade** 0–9999 e **Preço unitário** ≥ 0, 2 casas (clamp no blur).
- `src/pages/gestao/MedicaoPage.tsx` — **CP ensaiado/moldado** ≥ 0 inteiro; **Formas/Laudo/Visita/Fixo mensal** e **Adicional (valor)** ≥ 0, 2 casas.
- `public/sw.js` — `CACHE_NAME = consultegeo-geolab-v219`.
- `src/lib/telemetry/core.ts` — `APP_VERSION = v219`.

## Estratégia (igual v218)
Formato (sanitiza) + limite (`min`/`max` nativos + **clamp no `onBlur`**). Impossível → clamp corrige;
implausível → aviso, não bloqueia. Em Rompimentos os avisos existentes (`mpaForaFaixa`, "80% menor que o esperado") seguem intactos.

## Instalação (GitHub → Netlify)
Copie os 9 arquivos (mantendo os caminhos) para o repo, commit e push. CI: `check-source → tsc → vitest → vite build`. Sem migration/EF.

## Validação local
`check-source` OK · `biome lint src` EXIT=0 · `vite build` EXIT=0. `tsc` deixado para o CI.

## Cobertura acumulada (v218 + v219)
Todas as telas pedidas: Programação, Concretagem, Caminhões, Portal (Programação), Rompimentos (MPa/kN/tf/kgf, massa, dimensões), Financeiro (Contratos/Catálogo/Propostas/Medição) e Diário de cura (temperatura).
