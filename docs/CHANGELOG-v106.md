# CHANGELOG — v106 (Itens 1+2: reconciliação de versões + "insatisfatório" na idade de controle)

**APP_VERSION:** v105 → **v106** · **CACHE_NAME:** …-v105 → **…-v106**
**Build:** `npm run build` verde (check-source · biome · tsc · vitest 18/18 · vite).
**Migration:** 1 (mesma função de leitura `rompimentos_resumo`; só muda a regra do `insatisfatorio`).

## Item 1 — Reconciliação de numeração (somente documentação)
`docs/VERSOES-RECONCILIACAO.md` atualizado para a lineage **v103 → v104 → v105 → v106**, registrando a colisão de
numeração com a sessão paralela (que cortou o v103) e a decisão de **manter os números** (próxima livre: v107).
Sem mudança de código.

## Item 2 — "Insatisfatório" alinhado à idade de controle
**Antes:** o badge contava abaixo do fck em **qualquer idade** (=86 no piloto), enquanto o destaque vermelho da
linha já usava a **idade de controle** (=4) — inconsistente. **Agora:** as **3 superfícies** significam o mesmo
(abaixo do fck **na idade de controle** = `config_lab.idade_controle_default`, exceto idade em horas):
- **Badge/RPC** — `rompimentos_resumo` (migration 083) passa a contar `insatisfatorio` só na idade de controle.
- **Filtro "Mostrar Apenas Insatisfatórios"** — `src/pages/concreto/RompimentosPage.tsx`: o filtro agora exige a
  idade de controle (`r.idade_unidade !== 'hora' && Number(r.idade_dias) === idadeControle`), além de `res < esp`.
- **Destaque de linha** — já usava idade de controle (`abaixoFck && naIdadeControle`); inalterado.

No piloto, o badge "insatisfatório(s)" passa de **86** para **4**. Reversível (voltar RPC + filtro à variante
"qualquer idade").

> Observação: `rompido` continua contando **todos** os CPs com resultado (não muda); só "insatisfatório" foi
> alinhado. "Atrasado" segue global "até hoje" (definido no v105).

## Arquivos
`docs/VERSOES-RECONCILIACAO.md`, `src/pages/concreto/RompimentosPage.tsx`, `src/lib/telemetry/core.ts`,
`public/sw.js`, `SOURCE_VERSION.md`, `docs/CHANGELOG-v106.md` + migration
`083_rompimentos_resumo_idade_controle.sql`.

## Nota — convergência com sessão paralela
Uma **sessão paralela** implementou o item 2 de forma **independente** e gerou a migration
`083_rompimentos_resumo_idade_controle.sql` com SQL **funcionalmente idêntico** ao que esta sessão aplicou
(mesma lógica de idade de controle, mesma autorização `is_tenant_member`). Ambas foram aplicadas em produção
(idempotentes, `create or replace`) — a definição viva foi verificada e confere. Para evitar **dois arquivos 083**,
manteve-se o arquivo da sessão paralela (criado primeiro) e removeu-se o duplicado desta sessão. A regra de FE
(filtro "Mostrar Apenas Insatisfatórios") desta sessão permanece.
