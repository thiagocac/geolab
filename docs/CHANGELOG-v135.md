# CHANGELOG v135 — Delegação de aprovação ligada ao fluxo de laudo (gap #3)

## Banco — migration 112 (já aplicada via MCP)
- `aprovar_laudo` passa a aceitar: **`laudo.aprovar`** (papel/permissão/override) **OU uma delegação ativa** de
  `laudo.aprovar` que cubra a obra do laudo, dentro da janela definida. De quebra, o gate sai de papel-hardcoded
  (`admin/admin_consulte/gestor_qualidade`) para `current_has_permission('laudo.aprovar')` — coerente com o RBAC da v128.
- `current_tem_delegacao_aprovacao()`: helper booleano (o usuário logado é delegado ativo de aprovação de laudo?).

## Frontend
- **Laudos:** o botão **"Emitir"** aparece para quem tem `laudo.aprovar` **ou** é delegado ativo (`podeEmitir`);
  banner informando quando o acesso vem de delegação. As demais ações (Reabrir, Enviar ao cliente, Link de aprovação)
  seguem exigindo `laudo.aprovar` pleno.
- `delegacoes.ts`: `temDelegacaoAprovacao()`.
- Fecha o **gap #3** da revisão: a delegação registrada (que antes não tinha efeito) agora habilita a aprovação de verdade.

## Gate de build — rodado nesta sessão (espelho Netlify)
- `check-source` OK · `tsc --noEmit` **0 erros** · `vitest` **23/23** · `vite build` **✓**

CACHE_NAME=consultegeo-geolab-v135 · APP_VERSION=v135
