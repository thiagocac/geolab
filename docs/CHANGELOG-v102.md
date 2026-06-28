# CHANGELOG — v102 (UX/UI, frontend-only)

**APP_VERSION:** v101 → **v102** · **CACHE_NAME:** consultegeo-geolab-v101 → **…-v102**
**Origem:** `AUDITORIA-UXUI-GEOLAB.md` (auditoria tela-a-tela). **Sem** migration/Edge Function/mudança de banco.
**Build:** `npm run build` **verde** ponta-a-ponta (check-source · biome lint · tsc --noEmit · vitest 18/18 · vite).

Consolida 4 lotes entregues incrementalmente. Tudo reusa componentes já existentes do design system
(`useConfirm`, `StatusBadge`/`recordStatusMeta`, `Badge`, `DataTable` como referência de mobile).

---

## Lote 1 — Confirmação em ações consequentes/irreversíveis + texto enganoso
`useConfirm` (base-ui `AlertDialog`: foco-presilha, Esc, ARIA, botão `danger`) em **10 pontos**:
- **`LaudoAprovarPage`** (pública) — Aprovar/Devolver/Reprovar (uso único, irreversível).
- **`LaudosPage`** — **Emitir** (avisa que laudo **Final** vai ao cliente automaticamente) e **Reabrir**.
- **`ProgramacoesPage`** — Cancelar.
- **`EstruturaPage`** — Remover (grupos/tipos/peças; aviso de órfãos).
- **`MedicaoPage`** — Fechar medição.
- **`EmailLogPage`** — confirma **só na transição para envio real** (`dispatch_enabled` + `dry_run=false`).
- **`OperacaoPage`** — Desativar usuário.
- **`ClienteUsuariosPage`** — Revogar link e Desativar cliente.

**`NotificacoesPage`** — removido o texto **falso** "disparos em modo de simulação (dry-run)"; agora aponta a
fonte de verdade (*Sistema › E-mails*), que reflete o estado real do despacho.

## Lote 2 — Modo-cartão no `VirtualTable` (mobile)
`src/components/ui/VirtualTable.tsx`: desktop/tablet (`md+`) mantém a tabela virtualizada; **mobile** vira
cartões rótulo/valor (espelha o `DataTable`), com a coluna de ações como rodapé. Rótulos vêm dos cabeçalhos;
coluna de ações detectada por `id` — **API inalterada**. Hoje beneficia a `ProgramacoesPage` (único consumidor).

## Lote 3 — a11y de erro/dica nos campos (T1)
`src/components/ui/Field.tsx` (`Field`/`TextArea`/`SelectField`): erro/dica ligados por **`aria-describedby`**
(antes só `aria-invalid`) e **erro com ícone** (`AlertTriangle`) além da cor — não-só-cor (WCAG 1.4.1).
`hint` passa a `ReactNode` e disponível nos três. Retrocompatível. *Ativa* quando os forms passarem `error`.

## Lote 4 — `StatusBadge` no lugar de cor crua
`src/lib/status.ts` (`recordStatusMeta`) estendido: lote (`aceito`/`rejeitado`/`em_analise`), laudo/financeiro
(`emitido`/`emitida`/`paga`), medição (`fechada`/`faturada`). Cor-crua → `<StatusBadge>` (dot+bg+texto, tom
semântico, **dark mode**) em **Programações, Lotes, NC (status), Faturas, Medição, Concretagens**.

---

## Fora do escopo (de propósito)
- **`ColaboradoresPage`** — validade de certificação (vigente/a-vencer/vencida), vocabulário próprio (não record-status).
- **Severidade de NC** — vocabulário próprio (leve/média/alta).
- **Tabelas bespoke** `RompimentosPage` (`min-w-[1180px]` com edição inline), `LotesPage`, `NcPage` — mobile
  ainda por tratar (Lote 2 só cobre o `VirtualTable`).
- **Pills de domínio** (Backups/E-mails/Observabilidade) — já têm dark mode; não eram "cor crua".

## Arquivos tocados (v101 → v102)
**UX (16):** `LaudoAprovarPage`, `ProgramacoesPage`, `EstruturaPage`, `LaudosPage`, `MedicaoPage`,
`EmailLogPage`, `OperacaoPage`, `ClienteUsuariosPage`, `NotificacoesPage`, `LotesPage`, `NcPage`,
`FaturasPage`, `ConcretagensPage`, `components/ui/VirtualTable.tsx`, `components/ui/Field.tsx`, `lib/status.ts`.
**Versão (3):** `src/lib/telemetry/core.ts`, `public/sw.js`, `SOURCE_VERSION.md`.

## Próximos (sugeridos)
Wiring de `error` nos formulários-chave (ativa o T1) · tabelas bespoke responsivas · severidade de NC como
Badge + validity-badge da ColaboradoresPage.
