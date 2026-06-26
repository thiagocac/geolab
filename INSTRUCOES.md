# INSTRUÇÕES — Release CONSOLIDADO v91 (portal + ficha + papéis + bloco v1.1) — UM push

Supersede v80–v90. Contém TODO o trabalho da sessão. **Um push** com os arquivos abaixo.

## Já aplicado por mim via MCP (NADA a fazer no Supabase)
Migrations: **063 · 064 · 065 · 066 · 067 · 068 · 069** (069 = `portal_financeiro()` — medição/faturas ao cliente).
EFs: lab-client-portal v10 · portal-anexo v2 · client-portal-submit-programacoes v9 · notify-cliente-evento v2 · generate-ficha-moldagem-pdf v12 · extract-ficha-vision v4. (Laudo v15 já live, da trilha paralela.)

## Novidade v91 — Bloco v1.1 no portal + 4 recursos nas permissões
Aba nova **"Acompanhamento"** no portal do cliente, com 3 seções (cada uma gated por permissão):
- **Agenda de rompimentos** (ver_agenda): CPs pendentes e a data prevista de ensaio (derivado dos resultados, sem backend novo).
- **Medição / faturamento** (ver_medicao): faturas + medições da empresa (RPC `portal_financeiro`, read-only, escopo por cliente).
- **Não conformidades** (ver_nc): seção pronta + placeholder honesto — o modelo de NC ainda não tem vínculo com obra (gatilhos desligados na v1); a lista aparece quando o lab vincular NCs às obras.
**Dossiê da obra** (ver_dossie): botão na aba Resultados que baixa o pacote (Excel + PDF) do filtro atual.
Os **4 recursos** entram automaticamente na tela "Configurar acesso" (ela renderiza a lista de FEATURES) e nos perfis.

## Frontend para commitar (GitHub → Netlify CI)
Novos desta etapa: `src/components/portal/AcompanhamentoPortal.tsx`. Alterados: `src/lib/api/portalPermissoes.ts`, `src/lib/api/portalResultados.ts`, `src/components/portal/LaudosResultadosPanel.tsx`, `src/pages/portal/ClientePortalPage.tsx` + (ref.) migration 069. (+ tudo das etapas anteriores; lista completa no zip.)
Bump: src/lib/telemetry/core.ts (v91) + public/sw.js (v91).

## Gate
check-source OK; revisões independentes (incl. v91 — pegou e corrigi um bug de TDZ): SHIP, 0 must-fix pendente. tsc/biome/vitest no Netlify CI.
Lembrete: alerta < fck envia e-mail real ao cliente (prod dispatch on) — confirme o 1º envio.
