# CHANGELOG v150 — Equipamentos Pacote 1: cadastro à altura (Drawer + DataTable + anexo + apelido + guarda) — FE + migration 131

Base **v149**. Primeiro dos três pacotes do mapeamento de equipamentos (foco em prensas). Traz a tela de
equipamentos ao mesmo nível da de colaboradores (v146) e prepara o terreno multi-prensa. O modelo de dados
já estava quase pronto (a v137+ trouxe `capacidade_kn`/`classe`/`numero_serie`/`numero_certificado`/
`data_calibracao`/`anexo_certificado_path`/`ativo`/`tipos_ensaio[]`); este pacote passa a **usar** o que
estava invisível e adiciona só o `apelido`.

## Migration 131 (APLICADA no vivo, 02/07)
`equipamentos.apelido text` (nullable) — rótulo curto para distinguir prensas idênticas no seletor de
rompimento, na fila e no laudo, quando marca/série não bastam. UI usa `coalesce(apelido, marca_modelo)`.
Aditiva. Registro em `docs/131_equipamentos_apelido.sql`. **Verificado no vivo**: `notify_scan_calibracao`
(scan 081) já filtra `ativo=true` — equipamento inativo não gera alerta de calibração; sem mudança.

## 1. Tela dedicada (Modal genérico → componente próprio)
`EquipamentosPage` substitui a aba genérica do `AdminListPage` (mesmo mecanismo do `dedicated` usado por
Colaboradores/Materiais no `CadastrosPage`). **Drawer** (wide) no lugar do modal central; formulário
organizado em blocos (identificação · Calibração · situação/observação).

## 2. Lista → DataTable com busca/filtros/ordenação
Colunas **Equipamento** (apelido em destaque + marca/série como subtítulo; ordenável) · **Tipo** (chip;
ordenável) · **Calibração** (status em dia/vence em breve/vencida + data; ordenável) · **Situação**
(Ativo/Inativo) · **Ações** (certificado/Editar/Excluir). Barra com **busca** (apelido/marca/série/
certificado), **filtro por tipo**, **filtro de calibração** (vencida / vence em 30 dias) e **Só ativos**
(default ligado). Filtro/sort no cliente. No mobile cada linha vira card.

## 3. Colunas antes invisíveis, agora expostas
- **`ativo`**: checkbox Ativo no Drawer (equipamento inativo some dos seletores e não gera alerta de
  calibração).
- **`anexo_certificado_path`**: `<input type=file accept=pdf,image>` no bloco Calibração → upload para o
  bucket `anexos` (path `<tenant>/equipamentos/<id>/<ts>-<arquivo>`, 15 MB, mesmo contrato de RLS do NC/
  colaboradores). Botão **"certificado"** na lista e "ver certificado atual" no Drawer abrem por signed URL
  (300s) via `openDeferredTab` — sem popup-blocker. No cadastro novo, o upload usa o id real após o insert
  (path definitivo, sem `tmp`).
- **`observacao`**: campo livre.
- **`apelido`**: campo com hint ("Ex.: Prensa 1").

## 4. Guarda de exclusão
`excluir()` chama **`contarUsoEquipamento(id)`** — conta `material_tests.equipamento_id` — e, se houver uso,
o ConfirmDialog avisa "**aparece em N rompimento(s)**; o vínculo permanece nesses registros (e no laudo);
prefira **Inativar**". Best-effort (contagem falhou → confirmação simples). Exclusão continua soft-delete.

## Arquivos
`src/lib/api/equipamentos.ts` (novo: list/ref/save/softDelete/uso/anexo + `rotuloEquip`/`TIPOS_EQUIP`) ·
`src/pages/cadastros/EquipamentosPage.tsx` (novo) · `src/pages/cadastros/CadastrosPage.tsx` (aba dedicada) ·
`docs/131_equipamentos_apelido.sql` (novo) · `public/sw.js` + `src/lib/telemetry/core.ts` (bump) ·
`SOURCE_VERSION.md` · este changelog.

## Fora do escopo (próximos pacotes do mapeamento)
- **Pacote 2 (FE puro):** seletor "Prensa utilizada" filtrado por `tipo='prensa'`+ativo (hoje lista tudo) ·
  coluna "Prensa" nos lançados + filtro por prensa na fila · importações (lote clássico + Excel) gravando
  `equipamento_id`.
- **Pacote 3 (FE + migration 132 + EF agenda):** `equipamento_obras` (alocação prensa↔obra) + agenda por
  prensa (filtro/contadores + PDF agrupado por prensa).
- **v1.1:** histórico de calibrações (supersede), prensa por CP na grade, digest por prensa, utilização por
  prensa, vínculo `tipos_ensaio[]`.

## Gate (espelho Netlify) — exit 0
check-source **OK** · biome **0 erros** (14 warnings baseline) · tsc --noEmit **0** · vitest **23/23** ·
**vite build OK** · 0 `window.open(await…)`.
