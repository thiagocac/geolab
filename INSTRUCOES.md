# GEOLAB — Patch v25 (upload de logo do laboratório)

Gap de v1 fechado: o admin sobe o **logo** do lab em Preferências; o laudo passa a
imprimir a marca (a EF já lia `config_lab.logo_path`).

## Backend já aplicado (via MCP)
- **Migration `025_storage_lab_logo_policy`** — policy de Storage escopada: membro do
  tenant lê/grava SÓ `lab-reports/{tenant_id}/logos/` (laudos seguem só via service-role).

## Frontend
| Arquivo | Mudança |
|---|---|
| `src/lib/api/preferencias.ts` | `logo_path` no tipo/select + `uploadLogo` + `logoSignedUrl` |
| `src/pages/gestao/PreferenciasPage.tsx` | seção de logo (preview + upload PNG/JPEG + remover) |
| `public/sw.js` · `core.ts` · `Layout.tsx` | `v25` |

## Notas
- Upload aceita PNG/JPEG (o laudo embute via pdf-lib; sem WOFF2/outros formatos).
- Caminho: `{tenant_id}/logos/logo.{png|jpg}`; `config_lab.logo_path` atualizado.
- Toggle "logo_laboratorio" do laudo já vem ligado por padrão (Preferências › laudo).

Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
