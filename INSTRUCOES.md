# GEOLAB — Patch v23 (Colaboradores + certificações)

Gap de v1 fechado: cadastro de colaborador agora gerencia **certificações** (NBR 15146-1/2,
CREA/CRQ/TER) com **número e validade**, e mostra um **indicador visual de validade**
(válida / vence em breve ≤30d / vencida) — em vez do cadastro básico (só nome/doc/registro).

## Sem backend novo (tabela `colaborador_certificacoes` já existe, migration 005; RLS por tenant)

| Arquivo | Mudança |
|---|---|
| `src/lib/api/colaboradores.ts` | **NOVO** — listColaboradores (com certs embed), save, addCert, softDeleteCert |
| `src/pages/cadastros/ColaboradoresPage.tsx` | **NOVO** — lista com chips de validade + modal (dados + certificações) |
| `src/pages/cadastros/CadastrosPage.tsx` | aba "Colaboradores" agora é a página custom (saiu do AdminListPage) |
| `public/sw.js` · `core.ts` · `Layout.tsx` | `v23` |

## Notas
- Alerta visual na v1 (chip colorido). Alerta por e-mail de certificação vencendo pode
  reusar o cron-watchdog num próximo passo (hoje o cron faz só calibração de equipamento).
- Tipos sugeridos: NBR 15146-1 (Moldagem), NBR 15146-2 (Rompimento), CREA, CRQ, TER, Outro.

Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
