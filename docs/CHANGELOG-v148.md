# CHANGELOG v148 — Etiquetas fase 2: bip do QR na tela de Rompimentos — FE-only

Base **v147**. Fecha a "fase 2 (barata)" anotada no handoff e no CHANGELOG-v147: o leitor USB de QR se
comporta como teclado — bipar a etiqueta do CP no campo **Buscar** de Rompimentos localiza o CP e **foca
direto o campo de carga** para lançar. Zero digitação, casamento determinístico pelo `CP:<uuid>`.

## Fluxo do bip
1. O leitor digita `CP:<uuid>` no Buscar. O `onChange` detecta o payload completo (regex de uuid),
   **limpa o campo** (o Enter de sufixo do leitor cai no vazio) e chama `bipEtiqueta(uuid)`.
2. **`cpPorQr(id)`** (novo, em `src/lib/api/etiquetas.ts`): select por PK em `corpos_prova`
   (`id, codigo, numeracao_lab, situacao, material_tests(resultado_valor)`), `deleted_at is null`,
   `maybeSingle`. RLS escopa por tenant — uuid de outro laboratório retorna null.
3. Encontrado → a página **isola o CP**: zera os filtros que poderiam escondê-lo (tipo/idade/cliente/
   obra → "todas", janela → "todos", insatisfatórios off, página 0), define `nfFiltro = codigo` (único
   por CP, presente no haystack da busca) e, se o CP está **lançado ou com situação ≠ pendente**, liga
   `mostrarLancados` — necessário porque o fetch default (`carregarTudo=false`) traz **só pendentes**.
4. **Foco agendado** por `focoCpId` + `useEffect` sobre `pageRows`: quando o CP aparece na grade
   (imediato para pendentes; após o refetch quando `carregarTudo` muda), `focus()+select()+
   scrollIntoView` no input `romp-val-<idx>` — o mesmo id que o Enter-pula-próximo já usa.
5. Toasts: **localizado** (success) · **já lançado — exibindo para conferência** (info; v94 impede
   re-gravação sem edição) · **descartado** (info) · **não encontrado neste laboratório** (error).

## Decisões
- Detecção no `onChange` (não no Enter): funciona com qualquer sufixo configurado no leitor (Enter,
  Tab ou nenhum) e também com colar o payload manualmente.
- Isolar por `codigo` em vez de injetar o uuid no haystack: mantém o filtro legível/limpável pelo
  usuário e o comportamento da busca inalterado para digitação normal.
- `focoCpId` como estado + efeito (não setTimeout): determinístico — espera o dado chegar, foca uma
  única vez e se limpa.

## Arquivos
`src/lib/api/etiquetas.ts` (+`cpPorQr`; shim ganha `from()`) · `src/pages/concreto/RompimentosPage.tsx`
(import `useEffect`/`cpPorQr` · estado `focoCpId` · `bipEtiqueta` + efeito de foco · onChange/placeholder
do Buscar) · `public/sw.js` + `src/lib/telemetry/core.ts` (bump) · `SOURCE_VERSION.md` · este changelog.

## Teste manual
1. Bipar etiqueta de CP **pendente** → filtros zeram, grade mostra o CP, cursor no campo de carga
   (selecionado), toast "localizado". Digitar a carga + Enter segue o fluxo normal.
2. Bipar CP **já lançado** → "Só pendentes" desliga sozinho, CP aparece com o resultado, toast de
   conferência.
3. Bipar duas vezes seguidas → segundo bip re-foca (idempotente).
4. Bipar uuid de outro lab / inexistente → toast de erro, filtros intactos.
5. Colar `CP:<uuid>` manualmente no Buscar → mesmo comportamento do bip.

## Gate (espelho Netlify) — exit 0
check-source **OK** · biome **0 erros** (14 warnings baseline) · tsc --noEmit **0** · vitest **23/23** ·
**vite build OK** · 0 `window.open(await…)`.

## Próximo passo natural (fora deste release)
O mesmo bip servindo para **check-in de recebimento no lab** (chegada do CP do campo) — reaproveita
`cpPorQr`; entra quando a tela de recebimento existir como fluxo próprio.
