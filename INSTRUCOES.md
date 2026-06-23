# GEOLAB — Patch v24 (Concretagem retroativa)

Item de navegação da spec fechado: a Nova concretagem agora tem **Tipo** (Programada /
Retroativa). Em retroativa, aparece o campo **Justificativa** (`retroativa_justificativa`),
para registrar um evento passado. Origem='retroativa' grava no banco; o resto do fluxo
(caminhões/CPs/rompimento/laudo) é o mesmo.

| Arquivo | Mudança |
|---|---|
| `src/pages/concreto/ConcretagensPage.tsx` | seletor Tipo (origem) + justificativa condicional |
| `public/sw.js` · `core.ts` · `Layout.tsx` | `v24` |

Build completo verde. Push em `main`.
