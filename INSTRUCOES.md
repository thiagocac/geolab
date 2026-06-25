# v65 — Validação com React Hook Form + Zod no cadastro · Fase 3 (3/n)

Fecha o **tripé do padrão de cadastro** (drawer + form + validação). O `AdminListPage` passa a gerenciar o
form com **React Hook Form** (`Controller`, mantendo os Fields controlados) e validar com **Zod** via um
**resolver customizado** de ~10 linhas (`safeParse` → erros do RHF) — **sem `@hookform/resolvers`**, robusto
à versão do Zod 4. Erros aparecem **por campo** (borda magenta + mensagem); submit inválido é bloqueado. Gate verde.

## Dep nova
- `+ react-hook-form@^7` (7.80; peer React 19 ok). Zod já existia (v57). **Após o pull: `npm install`.**

## Arquivos alterados (sobrescrever no repo)
- `src/components/patterns/AdminListPage.tsx` — form manual (`useState` form/setForm) → `useForm` + `Controller`;
  schema Zod derivado do `FieldSpec` (required + tipo); **resolver custom** (`safeParse`); `openNew`/`openEdit`→`reset`;
  `runLookup`→`setValue`; `save`→`handleSubmit(onValid)`; erro por campo via `formState.errors`
- `src/components/ui/Field.tsx` — `Field`/`TextArea`/`SelectField` ganham prop `error` (mensagem + `aria-invalid`)
- `src/styles.css` — `.input[aria-invalid="true"]` borda magenta
- `core.ts` / `public/sw.js` / `SOURCE_VERSION.md`

## Como funciona o resolver Zod (sem @hookform/resolvers)
- `const r = schema.safeParse(values)` → sucesso `{values, errors:{}}`; falha → mapeia `r.error.issues` p/ o
  formato do RHF `{campo: {type, message}}`. **Version-proof** (não depende da compat resolver×Zod).
- O schema valida hoje obrigatoriedade + tipo (number/string). Dá p/ enriquecer por `FieldSpec`
  (min/max/email/regex) incrementalmente, sem mexer no wiring.

## Padrão de cadastro — núcleo da Fase 3 fechado
- **v63** ConfirmDialog (AlertDialog) · **v64** Drawer lateral (padrão A) · **v65** RHF + Zod.
  Todos os cadastros do `AdminListPage` agora: abrem em drawer, validam por campo e confirmam exclusão com diálogo acessível.

## Próximo (v66)
- **Página dedicada (padrão C)** p/ o form LONGO (Nova Programação) + Popover/Select/Tabs/Tooltip do Base UI;
  migrar `Modal.tsx` → Base UI Dialog (a11y) onde fizer sentido.
