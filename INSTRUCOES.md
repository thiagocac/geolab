# INSTRUÇÕES — Patch v134 (linha do tempo embutida) — ATENÇÃO: sessões paralelas

**Contexto:** durante esta sessão, outras sessões publicaram **v132** (numeração de CP na moldagem) e **v133**
(toggles da ficha). Esta entrega foi **re-baseada sobre o completo v133**, então o **completo v134 contém tudo**
(v130→v133 + a linha do tempo). **Recomendado: use o `consultegeo-geolab-source-completo-v134.zip` como fonte da
verdade** (extrair por cima do repo) para evitar buraco entre as releases paralelas.

## Arquivos alterados nesta entrega (sobre v133)
- `public/sw.js` · `src/lib/telemetry/core.ts`            — bump v134
- `src/components/TimelineList.tsx`                       — NOVO
- `src/pages/gestao/TimelinePage.tsx`                     — usa TimelineList + deep-link
- `src/pages/concreto/ConcretagemDetalhePage.tsx`        — card "Linha do tempo" (preserva a numeração na moldagem do v132/v133)
- `SOURCE_VERSION.md` · `docs/CHANGELOG-v134.md`

## Backend
- Sem mudança (RPCs de timeline já existiam).

## Gate (rodado nesta sessão): check-source OK · tsc 0 erros · vitest 23/23 · vite build OK
