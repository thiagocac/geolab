# CHANGELOG v146 — Gestão de colaboradores: funções/ativo + Drawer/DataTable + guarda + anexo (Pacotes 1 e 2) — FE-only

Base **v145**. Rebase dos Pacotes 1 (v132) e 2·parte 1 (v133) do mapeamento de colaboradores — aqueles zips
colidiram em numeração com releases publicadas e **nunca subiram**; este release reimplementa tudo sobre a
linha viva. **Nenhuma migration/EF nova**: as colunas `colaboradores.funcoes`/`ativo`,
`colaborador_certificacoes.anexo_path` e o bucket `anexos` (RLS por tenant, padrão do NC) já existem em
produção. O backend do alerta de certificação (parte 2 do Pacote 2) **já está vivo** desde 01/07:
migration **126** (`notify_scan_certificacao` + evento `certificacao_vencendo` em `role_notification_types`
para admin/gestor_qualidade + cron diário, espelho do scan de calibração) e **127** (fix de grants
PUBLIC/anon) — este release só liga o frontend a ele.

## 1. Pacote 1 — funções + ativo (fecha o "financeiro-vira-moldador")
- Cadastro grava **`funcoes`** (chips toggle: Moldador · Laboratorista · Técnico · RT) e **`ativo`**.
- Fonte única **`listColaboradoresRef()`** (query `['colaboradores-ref']`, select leve) +
  **`filtrarPorFuncao(refs, funcao)`** com comparação normalizada (acentos/caixa) e **fallback
  permissivo**: enquanto ninguém do lab tiver a função marcada, o seletor mostra todos os ativos —
  não trava a operação na transição; conforme as funções são marcadas, afunila sozinho.
- Seletores religados: **moldador** em Nova Programação e Concretagem › detalhe (`'Moldador'`) e
  **operador/quem rompeu** em Rompimentos (`'Laboratorista'`).
- Efeito colateral bom: a coluna **Funções** da Produtividade, que aparecia vazia, ganha conteúdo.

## 2. Cadastro: Modal → Drawer lateral
`ColaboradoresPage` troca o `Modal` central pelo **`Drawer`** (`wide`), padrão DS 24/06 para cadastro
curto/médio — desliza pela direita e mantém a lista visível. Formulário e salvar inalterados, agora com
o bloco de funções e o checkbox Ativo.

## 3. Lista: flex-list → DataTable com busca/filtros/ordenação
Colunas **Nome** (ordenável; registro como subtítulo) · **Funções** (chips) · **Certificações** (badges
de status) · **Situação** (Ativo/Inativo, ordenável) · **Ações**. Barra com **busca** (nome/CPF/registro),
**filtro por função**, **filtro por certificação** (*com vencida* / *sem certificação*) e **Só ativos**
(default ligado). Filtro/sort no cliente sobre a query existente (lista de um lab é pequena). Estado
"Nenhum colaborador para os filtros" distinto do vazio real. No mobile cada linha vira card (DataTable).

## 4. Guarda de exclusão
`excluir()` chama **`contarUsoColaborador(id)`** — conta `concretagens.moldador_id` e
`material_tests.operador_id` (FKs verificadas no schema vivo) — e, se houver uso, o ConfirmDialog avisa
"**aparece em N concretagem(ns) e M rompimento(s)**; o nome permanece nesses registros; prefira
**Inativar**". Best-effort: contagem falhou → confirmação simples. Exclusão continua **soft-delete**.

## 5. Anexo de certificação
- **`uploadCertAnexo(tenant, colaboradorId, file)`** → bucket **`anexos`**, path
  `<tenant>/colaboradores/<colaboradorId>/<ts>-<arquivo>` (1º segmento = tenant_id, mesmo contrato de
  RLS do NC; namespaced, sem colidir com anexos de NC). `assertUploadSize` (15 MB).
- `addCert` aceita `anexoPath` → grava `colaborador_certificacoes.anexo_path`.
- **`signedCertAnexo(path)`** (300s) + botão **"anexo"** por certificação via `openDeferredTab`
  (aba síncrona no clique; sem popup-blocker — invariante do `pdf.ts`).
- Formulário: `<input type="file" accept="application/pdf,image/*">` ao lado de Tipo/Número/Validade;
  upload acontece no "Adicionar"; input remontado por `key` após cada adição.

## 6. Alerta de vencimento de certificação — frontend ligado
`NotificacoesPage` ganha o toggle de preferência e o rótulo do evento **`certificacao_vencendo`**
("Certificacao de colaborador vencendo (30d)"). O scan/cron/evento já estão vivos (126/127); nasceu
dormente (0 certificações no seed) — dispara quando a primeira cert com validade for cadastrada.

## Arquivos
`src/lib/api/colaboradores.ts` (reescrito) · `src/pages/cadastros/ColaboradoresPage.tsx` (reescrito) ·
`src/pages/concreto/NovaProgramacaoPage.tsx` · `src/pages/concreto/ConcretagemDetalhePage.tsx` ·
`src/pages/concreto/RompimentosPage.tsx` · `src/pages/gestao/NotificacoesPage.tsx` ·
`public/sw.js` + `src/lib/telemetry/core.ts` (bump) · `SOURCE_VERSION.md` · este changelog.

## Gate (espelho Netlify) — validado nesta sessão, exit code 0
check-source **OK** · biome **0 erros** (14 warnings pré-existentes da base v145) · tsc --noEmit **0** ·
vitest **23/23** · **vite build OK**. Invariantes: 0 `window.open(await…)`; sem `<form>` nativo /
localStorage / lucide nos arquivos tocados.

## Conferências recomendadas no vivo (não bloqueiam)
```sql
SELECT ativo, count(*) FROM colaboradores GROUP BY 1;      -- NULL → UPDATE ... SET ativo=true
SELECT id, nome, funcoes FROM colaboradores ORDER BY nome; -- fallback cobre funcoes vazio
```
Policy do bucket `anexos`: INSERT/SELECT por `authenticated` escopada ao 1º segmento = tenant_id
(a mesma que o NC já exercita).

## Fora do escopo (v1.1+, decisão do mapeamento)
`member_id` (vínculo login), contato do colaborador, órgão emissor/data de emissão, tipos de
certificação configuráveis por lab, drill-down por colaborador, cert no laudo. Decisões 1–3 do
mapeamento (store DocGate, RT/ART, acoplamento cert↔função): **manter como está** (decisão Thiago).
