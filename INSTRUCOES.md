# v74 — Correções da auditoria v60→v73

Auditoria minuciosa de toda a leva (v60→v73): gate cumulativo **verde**, z-index coerente, deps+overrides ok,
**zero** CSS duplicado, **zero** resíduo (window.confirm / Modal antigo / Sparkline / autoFocus / @tailwind),
modais do Base UI todos **guardados** contra null no exit. **Nenhum bug funcional.** Corrigi 2 achados legítimos:

## Achado 1 — perf: Recharts carregava no landing
- O `DashboardPage` importava recharts **estático** → o chunk `charts` (119KB gz) carregava no `/` (landing),
  bloqueando os KPIs. **Fix:** extraí o gráfico p/ **NOVO** `src/pages/DashboardCharts.tsx` (default export) +
  `lazy()` + `Suspense` (fallback skeleton). Agora o `DashboardPage` (3,8KB) renderiza os KPIs na hora e o
  recharts (chunk `charts`) carrega **depois**, sem bloquear.

## Achado 2 — robustez: paste multi-coluna no grid de rompimentos
- `handlePaste` fazia `s.trim()` → colar 2 colunas do Excel guardava `"33.5\t28"` (`Number()` falha). **Fix:**
  `s.split('\t')[0].trim()` (pega a 1ª célula de cada linha). Colar 1 coluna segue igual.

## Arquivos alterados (sobrescrever no repo)
- **NOVO** `src/pages/DashboardCharts.tsx`
- `src/pages/DashboardPage.tsx` (lazy + Suspense; sem import estático de recharts)
- `src/pages/concreto/RompimentosPage.tsx` (`handlePaste` tab-safe)
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## Sem dep nova → só `git pull` + deploy.

## Resultado da auditoria (o que estava OK, sem ação)
- Versão/guard v74; deps (base-ui/rhf/tanstack/recharts) + `overrides` date-fns; `tailwind.config.js` removido;
  slate override completo (11 steps); **z-index coerente** (modal 70-71 < tooltip 75 < toast 80 < confirm 90-91);
  0 CSS duplicado; Recharts com `height` definido; modais do Base UI guardados contra null. ✓
- Os 8 warnings do Biome são **intencionais** (a11y / useExhaustiveDependencies em `warn`) ou pré-existentes (1 useLiteralKeys em MateriaisPage, anterior à leva).
