# Patch v76 — UX dos modais de cadastro (scroll, alinhamento, foco)

Release **v76** (sobre o source v75). Mesma correção preparada como v72 (nunca chegou a entrar; os 7 arquivos
de código seguiam idênticos ao v71) — **re-aplicada sobre o v75** e bumpada para v76. Corrige: sem barra de
rolagem, título/rodapé cortados, "cursor sai da tela" ao digitar e campos desalinhados nos modais de cadastro.
Diagnóstico completo por tela em `GEOLAB-Revisao-Modais-Cadastro-v72.md`.

## Arquivos alterados (este zip = só os alterados)
- `src/components/ui/Modal.tsx` — cabeçalho fixo + corpo rolável + rodapé fixo (espelha o `Drawer`).
- `src/styles.css` — `.bui-modal` flex-column + `.bui-modal-head/-body/-foot`; `wide` 768→860px.
- `src/components/ui/Field.tsx` — `min-w-0` nas labels.
- `src/pages/cadastros/ColaboradoresPage.tsx` — pares de campo em grid (CPF/Registro, certificação).
- `src/pages/operacao/OperacaoPage.tsx` — Cargo/Telefone e Slug/CNPJ em grid.
- `src/pages/portal/ClienteUsuariosPage.tsx` — linha senha + botão (campo cresce, botão fixo).
- `src/pages/cadastros/MateriaisPage.tsx` — removido o `×` duplicado ("Concreto 1").
- `public/sw.js` + `src/lib/telemetry/core.ts` — bump `consultegeo-geolab-v76` / `v76`.
- `SOURCE_VERSION.md` — seção v76.

## Como aplicar
1. Copie estes arquivos por cima do repo (mantendo caminhos), **sobrescrevendo**.
2. `git add -A && git commit -m "v76: UX dos modais de cadastro (scroll/alinhamento/foco)" && git push` → Netlify builda.
3. Opcional local: `npm run build` (gate: check-source → tsc --noEmit → vitest → vite build).

## Smoke test pós-deploy (hard refresh: SW troca cache v75→v76)
- Cadastros → **Colaboradores** → Novo: digitar em Nome/CPF/Registro sem perda de foco; CPF e Registro alinhados; rolar com cabeçalho/rodapé fixos.
- Cadastros → **Traços** (modal largo): rolar o formulário longo — "Salvar traço" sempre visível; sem `×` fantasma.
- **Operação** → Novo usuário / Novo laboratório: Cargo/Telefone e Slug/CNPJ alinhados.
- Portal → **Usuários de clientes** → Novo: linha senha + "Gerar" alinhada.

> Se ainda houver perda **real** de foco em algum modal específico (re-render do Dialog por estado na página),
> o passo seguinte é isolar o estado num componente-filho (padrão de `FaturasPage`/`NcConfigPage`). Ver §7 do documento.
