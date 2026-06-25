# INSTRUÇÕES — Release CONSOLIDADO v83 (portal + ficha de moldagem, tudo da sessão num push só)

Consolida o que foram os releases v80 (portal em abas/Parcial-Final/Excel), v81 (12 melhorias do portal) e
v82 (ficha de moldagem Modelo A + OCR) em UM único release v83 — evita as colisões de numeração antigas.
Faça **um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations (xbdvyvvxvzmcosnekmfv): **063** (RPCs de resultados + Parcial/Final do portal) · **064** (classificação staff + observabilidade do magic link).
Edge Functions deployadas: **lab-client-portal v9** (`dfe2b8b1`) · **portal-anexo v1** (`2d65bdeb`) · **generate-ficha-moldagem-pdf v12** (`846fadcf`, Modelo A) · **extract-ficha-vision v4** (`fcf31a6e`, OCR Modelo A).

## Arquivos para commitar (GitHub → Netlify CI)
### Novos
- src/lib/portal/types.ts
- src/lib/portal/resultados.ts
- src/lib/api/portalResultados.ts
- src/components/portal/ParcialFinalBadge.tsx
- src/components/portal/LaudosResultadosPanel.tsx
- src/components/portal/EvolucaoExemplares.tsx
- src/pages/portal/PortalPublicoPage.tsx
- supabase/migrations/063_portal_resultados_parcial_final.sql            (ref.; já aplicada)
- supabase/migrations/064_portal_melhorias_classificacao_magiclink.sql   (ref.; já aplicada)
- supabase/functions/lab-client-portal/index.ts                          (ref.; já deployada v9)
- supabase/functions/portal-anexo/index.ts                               (ref.; já deployada v1)

### Alterados
- src/App.tsx
- src/lib/api/clientUsers.ts
- src/lib/api/concretagem.ts
- src/lib/api/laudo.ts
- src/lib/api/portalCliente.ts
- src/pages/portal/ClientePortalPage.tsx
- src/pages/portal/ClienteUsuariosPage.tsx
- src/pages/concreto/LaudosPage.tsx
- src/pages/concreto/ConcretagensPage.tsx
- src/lib/telemetry/core.ts  (APP_VERSION v83)
- public/sw.js               (CACHE_NAME consultegeo-geolab-v83)
- supabase/functions/generate-ficha-moldagem-pdf/index.ts  (ref.; já deployada v12)
- supabase/functions/extract-ficha-vision/index.ts         (ref.; já deployada v4)

## Conteúdo (resumo)
- **Portal do cliente** (`/portal-cliente`): abas Programação / Resultados&Laudos; filtros (obra, busca, Parcial/Final, status, idade, conformidade, período); selo **Parcial/Final por exemplar**; **Ver resultados inline** (com curva de evolução); **Excel** e **PDF** do filtro; painel-resumo; CPs atrasados; anexo NF/DANFE na programação; paginação; detalhes técnicos; acessibilidade.
- **Portal público (magic link)** `/portal/acesso/:token` + "Gerar link do portal" e gestão (último acesso/revogar) em Usuários de clientes.
- **Ficha de moldagem Modelo A** (paisagem): "Ficha em branco (PDF)" na Central de Concretagens, "Gerar ficha PDF" (pré-preenchida) no detalhe, e "Ler ficha preenchida" (OCR → conferência → caminhões/CPs).

## Gate
check-source OK; revisões independentes (portal e EF pdf-lib): SHIP, 0 must-fix. tsc/biome/vitest rodam no Netlify CI.
Confirme o 1º print da ficha (A4 paisagem, 100%).
