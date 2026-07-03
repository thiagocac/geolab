# v156 — Traço por obra: idade de controle por traço + gestão à mão (02/07/2026)

Origem: avaliação do recurso "traço por obra". O núcleo já estava certo (3 escopos obra>construtora>catálogo,
seleção agrupada com herança de fck/padrão de moldagem/slump, Duplicar existente). Esta release fecha as lacunas.

## Idade de controle por traço (normativo)
- **Migration 135**: `operational_materials.idade_controle_dias` (1–365; null = `config_lab.idade_controle_default` → 28).
- **Migration 136**: `rompimentos_resumo` — "insatisfatório" resolve a idade de controle POR CP (traço > config do lab).
- **Migration 137**: `lancar_rompimentos_lote` — alerta abaixo-do-fck resolve por amostra via traço (payload = fallback).
- **Laudo EF v40** (`e298f8b1…`, MCP): `isCtrl` deixa de hardcodar 28d (traço > config_lab > 28); label da aceitação
  por exemplar passa a exibir "controle Xd"; regex NBSP do `san()` em escape ` ` (representação estável).
  Fecha o item de backlog da auditoria v155.
- Frontend: campo "Idade de controle (dias)" no CRUD de traços; Rompimentos calcula insatisfatório por CP
  (`idadeCtrlDe`: embed `operational_materials(idade_controle_dias)` no SELECT_CP).

## Gestão de traços por obra
- MateriaisPage (`/tracos`): filtro por obra + deep-link `?work=<uuid>` (seed único no mount).
- Nova Programação e Concretagem › detalhe: link "Gerenciar traços desta obra" ao lado do seletor.

## Flag `traco_habilitado` aposentada da UI
- Era gravada (wizard/CRUD de obras) e nunca lida. Removida da UI; coluna permanece DB-ready.
- Comportamento oficial: seletor por escopo + fallback manual (piloto: 42/43 concretagens com traço vinculado).

## Notas
- Versões vivas das EFs espelhadas saltaram hoje (ficha v34, agenda v10, etiquetas v3…) por redeploys da
  integração GitHub→Supabase nos pushes — conteúdo íntegro (espelhos corretos desde a blindagem/v155).
- Backlog que permanece: Central não distingue `cancelada`; labName da agenda sem `is_selected` (multi-lab);
  UNIQUE de código de traço por escopo (adiado — checar duplicatas antes).
