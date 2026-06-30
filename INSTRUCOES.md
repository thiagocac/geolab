# INSTRUÇÕES — Patch v126 (Operador "quem rompeu" como toggle de ensaio)

Patch **cumulativo** sobre o repositório (base v125). Copiar os arquivos por cima do source e dar push (GitHub → Netlify CI).

## Arquivos do patch (frontend)
- `public/sw.js`                           — bump CACHE_NAME=consultegeo-geolab-v126
- `src/lib/telemetry/core.ts`              — bump APP_VERSION=v126
- `src/lib/concreto/camposEnsaioLaudo.ts`  — catálogo CAMPOS_ENSAIO += `operador` (off por padrão)
- `src/pages/concreto/RompimentosPage.tsx` — gate do seletor de operador + da gravação de `operador_id`
- `SOURCE_VERSION.md`
- `docs/CHANGELOG-v126.md`

## Backend (sem ação no push)
- Migration **107_docgate_operador_blocks_respeitam_ensaio_campos** — **já aplicada via MCP** em `xbdvyvvxvzmcosnekmfv`.
  Verificada viva nos dois sentidos (campo off: 0 avisos de operador; on: avisos voltam). SQL de referência em `docs/107_*.sql`.

## Comportamento
- **Config. de Campos › Ensaio** ganha "Operador (quem rompeu)", **desligado por padrão**.
- Desligado: some o seletor em **Rompimentos**, `operador_id` não é gravado, e a **DocGate** não mostra avisos de operador.
- Ligado: seletor reaparece, grava `operador_id` e a DocGate volta a evidenciar operador/certificação.

## Gate de build (espelho Netlify)
`npm run check:source` → `tsc --noEmit` → `vitest run` → `vite build`  · check-source validado nesta sessão: OK
