# Release v2 — Frontend: fundação

Primeira release de frontend. App React reaproveitado do GEOMAT, reidentificado e adaptado ao schema GEOLAB.

## Entregue
- Login (Supabase), seleção de laboratório (N vínculos via select_tenant; 1 = auto-select), shell + painel.
- lib/auth.tsx adaptado: resolve member/tenant de `members` direto (a RLS permite o usuário ver os próprios vínculos); sem as views v_my_tenants/v_current_member do GEOMAT.
- database.types do GEOLAB. check-source adaptado (consultegeo-geolab + migrations não versionadas no source).

## Validação no sandbox
- check-source.mjs: OK (exit 0). Imports relativos: 0 quebrados. tsc/vitest/vite ficam para o Netlify CI.

## Deploy
Criar repo no GitHub, conectar ao Netlify geo-labs, configurar env vars (VITE_SUPABASE_URL/ANON do GEOLAB, VITE_DEMO_MODE=false). Smoke: login no LabTest → painel.

## Próximo: v3 (Cadastros).
