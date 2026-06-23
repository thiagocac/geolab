# GEOLAB — Patch v19 (revisão: consistência fck do traço)

Resultado da revisão minuciosa v8→v18: a camada de dados está **correta** (colunas,
enums, NOT-NULL, RLS, joins conferidos contra o schema real — nenhum bug encontrado nos
fluxos centrais). Único ajuste necessário: alinhar o fck.

## Ajuste
Ao escolher um **traço** na Nova concretagem, o `fck_previsto` era deixado em branco —
então o laudo usava `om.fck_mpa` mas o evento `resultado_abaixo_fck` (que lê
`conc.fck_previsto`) não disparava. Agora o fck do traço **auto-preenche** o campo
(se vazio) e aparece no dropdown. Alinha laudo + evento e evita digitar duas vezes.

| Arquivo | Mudança |
|---|---|
| `src/lib/api/concretagem.ts` | **+ `listTracosComFck`** (id, nome, fck_mpa) |
| `src/pages/concreto/ConcretagensPage.tsx` | seletor de traço auto-preenche fck_previsto + mostra fck no rótulo |
| `public/sw.js` · `core.ts` · `Layout.tsx` | `v19` |

## Auditoria — o que foi conferido (e está OK)
- Escrita concretagem→caminhão→amostra→CP→material_tests: todas as colunas existem,
  obrigatórias cobertas, `material_kind=concreto` válido, `situacao`/`origem`/`amostras.status` text.
- Cadastros (clientes/obras/contatos/colaboradores/equipamentos/contratos): field keys
  batem com colunas reais; required cobre NOT-NULL.
- RLS: members update exige admin (setMemberActive ok); config_lab/prefs/dispatch_log conferidos.
- Joins aninhados (concretagens→client_works, material_tests→concretagens, etc.): válidos.

Build completo (check-source+tsc+vitest+vite) verde. Push em `main`.
