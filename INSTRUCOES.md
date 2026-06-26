# INSTRUÇÕES — Release CONSOLIDADO v92 (portal + ficha + permissões + Tipos de ensaio) — UM push

Supersede v80–v91. **Um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations 063–069; EFs lab-client-portal v10 · portal-anexo v2 · client-portal-submit-programacoes v9 · notify-cliente-evento v2 · generate-ficha-moldagem-pdf v12 · extract-ficha-vision v4. (Laudo v15 já live.)

## Novidade v92 — Tela "Tipos de ensaio" (Cadastros)
Aba **"Tipos de ensaio"** no hub de Cadastros (CRUD sobre `material_test_types` via o componente genérico `AdminListPage`). **Sem migration e sem Edge Function** — a tabela e o RLS de escrita (`is_tenant_writer`) já existiam (migration 006). Campos: código, descrição, material, grupo (endurecido/fresco), unidade, resultado consolidado (máx/mín/média/mediana), idade de controle + unidade, dimensões padrão do CP, descarte automático, gera NC, enviar e-mail + idades, ensaio padrão, observação. Acesso restrito à equipe do laboratório (Cadastros).

## Frontend para commitar (GitHub → Netlify CI)
Alterado desta etapa: `src/pages/cadastros/CadastrosPage.tsx` (+ aba tipos_ensaio). Bump core.ts + sw.js (v92). (+ tudo das etapas anteriores; lista no zip.)

## Gate
check-source OK. (Atenção interna: a tela foi reconstruída em mount após uma corrupção de sync da ferramenta de edição; arquivo conferido — balanceado e completo.) tsc/biome/vitest no Netlify CI.
