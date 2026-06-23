# Release v3 — Cadastros

Framework de cadastros + telas das entidades-base do dominio GEOLAB.

## Entregue
- AdminListPage: lista (DataTable) + drawer de formulario (Modal) + busca + paginacao + soft-delete. Campos: text/number/date/select/textarea/boolean/reference (FK).
- lib/api enxuta: listRows (filtra deleted_at, busca por searchFields), listReference (FKs), createRow (injeta tenant_id), updateRow (updated_at via trigger), softDelete.
- CadastrosPage: 5 abas — lab_clients, client_works (FK cliente + flags estrutura/traco), client_contacts, colaboradores, equipamentos.

## Validacao no sandbox
- check-source OK; 0 imports quebrados. tsc/vitest/vite no Netlify CI.

## Proximo: v4 (Concretagem).
