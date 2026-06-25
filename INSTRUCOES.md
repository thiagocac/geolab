# GEOLAB v79 — Correcao: 404 do Netlify ao atualizar a pagina (SPA fallback)

## Bug
App usa `BrowserRouter` (history API): rotas como `/laudos`, `/concretagens` etc. sao
virtuais, resolvidas no cliente. O repo **nao tinha** `public/_redirects` nem `netlify.toml`,
entao em **refresh** ou **acesso direto** a uma rota o Netlify procurava um arquivo fisico
naquele caminho, nao achava, e servia a pagina **"Page not found"** dele. So a raiz `/` abria.

## Correcao
Adicionado `public/_redirects` com o fallback canonico de SPA. O Vite copia `public/` para
`dist/`, entao o arquivo chega na pasta publicada e o Netlify reescreve toda rota para
`index.html` (HTTP 200). Arquivos estaticos existentes (assets/fontes) tem precedencia e
nao sao afetados.

```
/*    /index.html   200
```

## Arquivos alterados (3)
- `public/_redirects` — **novo**. SPA fallback.
- `public/sw.js` — bump CACHE_NAME -> consultegeo-geolab-v79.
- `src/lib/telemetry/core.ts` — bump APP_VERSION -> v79.

(CACHE_NAME + APP_VERSION bumpados juntos via `npm run bump v79`; check-source passou.)

## Deploy
1. Copiar os arquivos deste zip para a raiz do repo (preservando caminhos).
2. git add public/_redirects public/sw.js src/lib/telemetry/core.ts
3. git commit -m "fix: SPA fallback _redirects (404 no refresh) + bump v79"
4. git push -> Netlify (geo-labs) builda e publica.

## Validacao pos-deploy
- Abrir https://app.concresoft.io/laudos direto (ou F5 nela) -> deve carregar a tela,
  nao o 404 do Netlify.
- Repetir em outra rota profunda (ex.: /concretagens).
- Rodape do menu deve mostrar "Concresoft v79".
