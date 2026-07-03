# GEOLAB — Release v159 (fix de publicação no Netlify)

Corrige a falha de build no Netlify que travou o site vivo na **v148** (as publicações de
v155/v157/v158 nunca subiram). **Não altera código de tela** — é fix de dependências + pin de Node
+ bump de versão. Inclui também arquivos "repo-only" que se perdiam ao espelhar.

## Causa
`npm ci` do Netlify (estrito) falhava em "Install dependencies" (exit 1) porque o
`package-lock.json` estava **dessincronizado** do `package.json`: o `xlsx@0.18.5` saiu do
`package.json` na v149 mas o lock manteve a entrada órfã `node_modules/xlsx`. O npm local
tolera; o `npm ci` do Netlify rejeita.

## Correção (v159)
- **`package-lock.json` regenerado do zero e canônico** (Node 22.22 / npm 10.9, `rm lock+node_modules; npm install`).
  Sem `xlsx` órfão; idempotente (re-rodar `npm install --package-lock-only` altera 0 linhas).
- **`.nvmrc` = `22`** e **`netlify.toml`** (`[build.environment] NODE_VERSION = "22"`) — fixam o Node no Netlify.
- Restaurados os repo-only usados nos e-mails transacionais:
  `public/brand/concresoft-lockup-white-2x.png` (referenciado em `send-notification`) e `-color-2x.png`.
- Bump **v159** (`CACHE_NAME` + `APP_VERSION`).

## Validado como o Netlify (checkout limpo, Node 22 / npm 10)
```
rm -rf node_modules && npm ci     # exit 0 — 291 pacotes em 19s (era exit 1 no Netlify)
npm run build                     # exit 0 — check-source · biome · tsc --noEmit · vitest 23/23 · vite build
```

## Arquivos (7) — todos neste patch, sobem no GitHub
```
package-lock.json                                   # regenerado (canônico)
.nvmrc                                              # novo — 22
netlify.toml                                        # novo — NODE_VERSION 22
public/sw.js                                        # CACHE_NAME v159
src/lib/telemetry/core.ts                           # APP_VERSION v159
public/brand/concresoft-lockup-white-2x.png         # novo (repo-only)
public/brand/concresoft-lockup-color-2x.png         # novo (repo-only)
```
`package.json` NÃO muda (já estava correto desde a v149).

## Aplicar
1. Copie os arquivos deste zip por cima do repo (mesma árvore). Garanta que `package-lock.json`,
   `.nvmrc`, `netlify.toml` e os 2 PNGs entrem no commit (`.gitignore` não os bloqueia).
2. `git add -A && git commit -m "v159: fix Netlify (lock canônico + pin Node 22)" && git push`
3. Netlify: `npm ci` passa → `npm run build` → site sai do v148 para o **v159**.
