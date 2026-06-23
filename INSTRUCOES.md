# GEOLAB — Patch v20 (fix: disparo do evento laudo_pronto)

## Achado em produção (dados reais do v18)
Você rodou o fluxo ponta a ponta no app vivo: 1 cliente, 1 obra, 1 traço, 1 concretagem,
2 caminhões, 8 CPs, 8 rompimentos, 1 laudo **emitido** (geração + aprovação funcionaram).
Mas `notification_dispatch_log = 0` — a notificação `laudo_pronto` não disparou.

## Causa
A EF `generate-laudo-ensaio-pdf` devolve o id do laudo no header `x-lab-report-id`,
mas o `cors` dela não inclui `access-control-expose-headers`. No browser, headers
customizados só são legíveis se expostos via CORS — então `resp.headers.get('x-lab-report-id')`
retornava `null`, `labReportId` ficava vazio, e o `gerarLaudo` pulava o `notifyLaudoPronto`.

## Correção (no front, sem mexer na EF que já funciona)
`gerarLaudo` agora, se o header vier vazio, **busca o laudo da concretagem** em `lab_reports`
(mais recente) para obter o id e disparar o `laudo_pronto`. Robusto independente do CORS.

| Arquivo | Mudança |
|---|---|
| `src/lib/api/laudo.ts` | `gerarLaudo` com fallback de busca do labReportId |
| `public/sw.js` · `core.ts` · `Layout.tsx` | `v20` |

## Nota (opcional, futuro)
A correção "de manual" seria adicionar `'access-control-expose-headers': 'x-lab-report-id'`
ao `cors` da EF do laudo. Não toquei na EF para não arriscar o PDF que já está saindo OK;
o fallback no front resolve.

Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
