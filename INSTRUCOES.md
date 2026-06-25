# Patch v72 — UX dos modais de cadastro (scroll, alinhamento, foco)

Release **v72** (a partir do source v71). Corrige a camada de **modais centrais** (Base UI Dialog)
e o **alinhamento de campos** que causava: sem barra de rolagem, título/rodapé cortados,
"cursor sai da tela" ao digitar e campos desalinhados. Detalhe completo por tela em
`GEOLAB-Revisao-Modais-Cadastro-v72.md`.

## Arquivos alterados (este zip = só os alterados)
- `src/components/ui/Modal.tsx` — cabeçalho fixo + corpo rolável + rodapé fixo (espelha o `Drawer`).
- `src/styles.css` — `.bui-modal` flex-column + `.bui-modal-head/-body/-foot`; `wide` 768→860px.
- `src/components/ui/Field.tsx` — `min-w-0` nas labels (robustez em grid/flex).
- `src/pages/cadastros/ColaboradoresPage.tsx` — linhas de campo em grid (CPF/Registro, certificação).
- `src/pages/operacao/OperacaoPage.tsx` — Cargo/Telefone e Slug/CNPJ em grid.
- `src/pages/portal/ClienteUsuariosPage.tsx` — linha senha + botão (campo cresce, botão fixo).
- `src/pages/cadastros/MateriaisPage.tsx` — removido o `×` duplicado ("Concreto 1").
- `public/sw.js` + `src/lib/telemetry/core.ts` — bump `consultegeo-geolab-v72` / `v72` (sincronizados).
- `SOURCE_VERSION.md` — seção v72.

## Como aplicar
1. Copie estes arquivos por cima do repo do GEOLAB (mantendo os caminhos), **sobrescrevendo**.
2. `git add -A && git commit -m "v72: UX dos modais de cadastro (scroll/alinhamento/foco)"`.
3. `git push` → o Netlify CI builda (gate: `check-source` → `tsc --noEmit` → `vitest` → `vite build`).
   - O bump já está aplicado; o guard de versão (`check-source`) passa.
4. Opcional local: `npm run build` para rodar o gate antes do push.

## Smoke test pós-deploy (hard refresh: o SW troca de cache v71→v72)
- Cadastros → **Colaboradores** → Novo: digitar em "Nome", "CPF", "Registro" — sem perda de foco;
  CPF e Registro lado a lado, alinhados; rolar com cabeçalho/rodapé fixos.
- Cadastros → **Traços** (modal largo): rolar o formulário longo — "Salvar traço" sempre visível no rodapé.
- **Operação interna** → Novo usuário / Novo laboratório: Cargo/Telefone e Slug/CNPJ alinhados.
- Portal → **Usuários de clientes** → Novo: linha de senha + "Gerar" alinhada.

> Observação sobre foco: a causa do "cursor sai da tela" é o *scroll-into-view* num modal sem
> scroll interno próprio — resolvido pela reestruturação do `Modal`. Se em algum modal específico
> ainda houver perda real de foco (re-render do Dialog por estado no componente da página),
> o passo seguinte é isolar o estado do formulário num componente-filho (padrão que `FaturasPage`
> e `NcConfigPage` já usam). Ver seção "Contingência de foco" no documento.
