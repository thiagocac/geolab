# Concresoft — Patch v78 — Revisão dos ícones do menu lateral

## O que mudou (somente front-end; sem banco/EF/rota)
Revisão de todos os ícones da sidebar. Trocas:

| Item do menu          | Antes (ícone)        | Depois (ícone)               |
|-----------------------|---------------------|------------------------------|
| Concretagens          | Truck (genérico)    | **MixerTruck** (betoneira)   |
| Rompimentos           | Flame (chama)       | **Compress** (prensa)        |
| Preferências           | Gauge               | **Settings** (engrenagem)    |
| Medição               | FileText            | **Ruler** (régua)            |
| Faturas               | FileText            | **Receipt** (recibo)         |
| Fôrmas                | Boxes               | **Mold** (molde cilíndrico) |
| Usuários de clientes  | Building2           | **Users** (pessoas)          |
| Config de NC          | ClipboardCheck      | **Sliders**                  |

Motivos: a chama não representa rompimento à compressão; o caminhão genérico não é betoneira; e havia colisões (FileText em Laudos/Medição/Faturas; Boxes em Cadastros/Fôrmas; Building2 em Portal/Usuários; Gauge em Preferências/Produtividade). As 3 telas "Campos…" seguem com ClipboardCheck de propósito (família). `Truck` e `Flame` continuam exportados em icons.tsx (não quebram nada).

## Arquivos (substituir no repo)
- src/components/ui/icons.tsx       (8 novos componentes SVG)
- src/components/Layout.tsx         (import + mapeamento dos itens)
- public/sw.js                      (CACHE_NAME consultegeo-geolab-v78)
- src/lib/telemetry/core.ts         (APP_VERSION v78)
- SOURCE_VERSION.md

## Como aplicar
1. Copie os 5 arquivos sobre o working copy do repo.
2. git add -A && git commit -m "v78: revisão dos ícones do menu (betoneira, prensa, etc.)"
3. git push → Netlify (geo-labs) builda.

## Gate validado no sandbox
check-source OK · biome lint (0 erros; 2 warnings de a11y pré-existentes no nav-scrim, não relacionados) · tsc --noEmit OK · vitest run 18/18.
