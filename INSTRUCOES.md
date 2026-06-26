# GEOLAB → Concresoft — Patch v94
## Revisão da tela de Resultados de Ensaios (`/rompimentos`)

Bump: `CACHE_NAME consultegeo-geolab-v94` + `APP_VERSION v94` (juntos).

### Arquivos no patch (sobem no GitHub)
- `src/pages/concreto/RompimentosPage.tsx` — correções + melhorias da tela.
- `src/lib/api/rompimento.ts` — idade de controle configurável no alerta < fck.
- `src/lib/telemetry/core.ts` — APP_VERSION v94 (bump).
- `public/sw.js` — CACHE_NAME v94 (bump).

### Como aplicar
1. `unzip -o consultegeo-geolab-source-patches-v94.zip` na raiz do repo.
2. `git add -A && git commit -m "v94: revisão da tela de resultados (/rompimentos)" && git push`.
3. Netlify CI builda (check-source → biome → tsc → vitest → vite).

### Bugs corrigidos
1. **Botão "Exportar fila" duplicava "Exportar modelo"** (mesmo handler). Agora "Exportar fila"
   gera um snapshot real do recorte (obra, NF, idade, previsto/realizado, esperado, situação);
   "Exportar modelo (p/ importar)" segue como template de ida-e-volta.
2. **Enter no campo de resultado SALVAVA o CP** (1 RPC por Enter), contrariando a ajuda da tela
   ("Enter pula para o próximo"). Agora Enter move o foco para o próximo CP; a gravação é no botão Salvar.
3. **"Salvar resultados" regravava CPs já lançados sem edição** (soft-delete + re-insert →
   churn em `material_tests`, ruído na trilha e re-disparo de notificação). Agora pula lançados
   sem edição; mensagem clara quando não há nada a gravar.
4. **`operador_id` pegava cegamente o 1º colaborador** da lista para todos os rompimentos.
   Removido. Adicionado seletor "Operador (quem rompeu)"; grava só o escolhido.
5. **Alerta "abaixo do fck" tinha 28d fixo** em `maybeNotifyAbaixoFck`, ignorando o
   `idade_controle_default` do laboratório. Agora recebe e usa a idade de controle configurada.
6. **`downloadBlob` revogava a object URL imediatamente** (pode abortar o download em alguns
   navegadores). Agora anexa o link ao DOM e adia a revogação (mesmo padrão do helper de Excel).
7. **Import não lia carga/unidade/massa**, embora o modelo exportado tenha essas colunas
   (round-trip quebrado). Agora aceita `carga` + `unidade_carga` (converte p/ MPa) e `massa_cp_g`.
8. **Botão "Trilha de alterações" no cabeçalho era morto** (só toast / modal já aberta). Removido;
   a trilha por linha continua.
9. **Filtro rotulado "Idade de controle"** filtrava qualquer idade (7d, desforma…). Renomeado p/ "Idade".

### Melhorias
- "Adotar Data Prevista" e "Adotar Data Referência" agora são mutuamente exclusivas.
- "Contraprova" pede confirmação e trata erro (antes criava CP sem aviso e engolia erros).
- `aria-label` nos checkboxes sem texto (selecionar todos / selecionar CP / descartar).
- Texto de ajuda da importação atualizado com as novas colunas aceitas.

### Notas
- Sem migration e sem Edge Function: a RPC `lancar_rompimento_cp` já aceitava `operador_id`,
  `carga_unidade` e `massa_cp_g`; o 4º parâmetro de `maybeNotifyAbaixoFck` é opcional (default 28),
  então os callers em `importacao.ts` seguem compilando.
- **Fora do pdfset** (laudo/portal/concretagens): este patch não conflita com o merge manual do `pdf.ts`.
- Gate local: `check-source` OK; **esbuild** (sintaxe + JSX + resolução de imports) OK nos 2 arquivos.
  `tsc`/`vitest`/`vite` rodam no Netlify (sandbox sem `node_modules`).
