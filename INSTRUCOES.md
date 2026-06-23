# GEOLAB — Patch v21 (revisão de UI/design: dark mode + responsivo + tokens)

Revisão completa de UI. Achado central: o `src/styles.css` é um **design system rico**
(tokens via CSS variables que respondem ao dark mode, classes `.card`/`.input`/`.btn`/
`.table`, e um shell de sidebar/topbar **responsivo** com `.nav-link`/`.nav-sect`/
`.theme-toggle`/sidebar mobile) — mas o Layout e as telas construídas o **ignoravam**,
usando inline styles com cores fixas. Resultado: dark mode quebrado e layout não-responsivo.

## Correções
1. **Layout reescrito no shell do design system**: `.app-shell` + `.sidebar` (com
   `.sidebar-brand`, seções `.nav-sect`, `.nav-link` ativos com a barra de acento) +
   `.topbar` + `.page-wrap`. Agora é **responsivo** (sidebar colapsa no mobile, com
   botão de menu e scrim) e o **theme-toggle** usa o componente estilizado (claro/escuro).
2. **Tokenização de cores** (49 nas páginas + 7 em LoginScreen/AdminListPage): hex fixo
   → CSS var (`#fff`→`var(--surface)`, `#e5e7eb`→`var(--line)`, `#374151`→`var(--ink-soft)`,
   `#6b7280`→`var(--ink-faint)`, `#182863`→`var(--ink)`, `#C5117E`→`var(--magenta)`…).
   Agora as telas **respondem ao dark mode**. Verde/âmbar de status (#16a34a/#d97706)
   preservados (legíveis nos dois temas).
3. `.hide-sm` (esconde o e-mail no topbar em telas pequenas).

## Arquivos
Layout, LoginScreen, AdminListPage, styles.css, e 11 páginas (Concreto, Cadastros,
Gestão, Operação, TenantSelection). Bump v21.

## Limite da revisão
Feita no nível de **sistema/consistência** (a extensão do Chrome estava offline, não deu
para inspecionar o render). Pega dark mode, responsividade e divergência de tokens.
Polimento visual fino (alinhamento, hierarquia, densidade) pede um olhar no app renderizado.

Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
