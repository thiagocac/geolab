# CHANGELOG v134 — Linha do tempo embutida (obra/concretagem)

> **v134 é cumulativo sobre v133** (inclui v130 fix-RBAC, v131 numeração lab + filtro, v132 numeração na moldagem,
> v133 toggles da ficha — releases de sessões paralelas) **mais** a linha do tempo embutida desta entrega.

## Frontend (esta entrega)
- Novo componente reutilizável **`TimelineList`** (cartões de evento).
- **Concretagem (detalhe):** card **"Linha do tempo"** com toggle **[Desta concretagem | Desta obra]**
  (usa `list_concretagem_timeline` / `list_work_timeline`) + "Abrir linha do tempo completa".
- **`/gestao/timeline`:** **deep-link** por query param (`?scope=work|concretagem&id=<uuid>`).
- Fecha o **gap #1** da revisão (RPCs por obra/concretagem já existiam; faltava a UI).

## Gate de build — rodado nesta sessão (espelho Netlify)
- `check-source` OK · `tsc --noEmit` **0 erros** · `vitest` **23/23** · `vite build` **✓**

CACHE_NAME=consultegeo-geolab-v134 · APP_VERSION=v134
