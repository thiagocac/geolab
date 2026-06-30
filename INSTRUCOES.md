# INSTRUÇÕES — consultegeo-geolab v143 (Onda 4: laudo PDF + certificações + normas)

**Use o COMPLETO v143** (cadeia cumulativa v138→v143). Publicar (GitHub → Netlify `geo-labs` → app.concresoft.io).

## Banco — JÁ aplicado no vivo (head 122)
- **122_config_lab_certificacoes** — coluna `config_lab.certificacoes jsonb default '[]'` (lista tipo/numero/orgao/validade).

## Edge Function — JÁ deployada no vivo (não vai pelo Netlify)
- **generate-laudo-ensaio-pdf v33** (ezbr `7bdd8d57…`, era `be3f63c2…`):
  - **2a** — removida a logomarca **CONCRESOFT** do topo (fica só a logo do laboratório, à esquerda).
  - **2b** — linha do exemplar passa a incluir o **Elemento concretado** (quando houver) e **sai a temperatura**.
  - **2c** — "Dados do concreto" segue configurável (cimento/cura/aditivo/dmax/componentes já são toggles).
  - **2d** — `clip` anti-overflow nos valores de dados, recebimento, equipamentos e na linha do exemplar (sem corte/sobreposição).
  - **Bloco 3** — nova seção **"Certificações do laboratório"** (lê `config_lab.certificacoes`; toggle no Config. de Campos).
  - **Bloco 4** — **normas por toggle com ano vigente**: NBR 5739:2018 · 5738:2015 · 16889:2020 · 16886:2020 (só aparecem as ligadas).

## Frontend (5 arquivos)
- public/sw.js · src/lib/telemetry/core.ts → bump **v143**
- src/lib/concreto/camposEnsaioLaudo.ts → toggles novos no Config. de Campos › Laudo: **Certificações** (off) + **4 normas** (on).
- src/lib/api/preferencias.ts → `certificacoes` no tipo/SELECT do config_lab.
- src/pages/gestao/PreferenciasPage.tsx → **cadastro de certificações** (lista: tipo, número, órgão, validade).

## Gate (espelho Netlify)
check-source OK · biome 0 erros · **tsc --skipLibCheck 0** · vitest 23/23 · esbuild OK · EF compilada no deploy + 9 marcadores conferidos.
Sugestão: após o push, emita um laudo de teste para conferir visualmente (sem logo Concresoft, linha do exemplar com elemento, normas, certificações se ligadas).

## Decisões do plano (resolvidas)
Aviso "<80% do esperado" (Onda 1) · hora de referência em vez de schema de hora-prevista (Onda 1) · certificações em `config_lab` (não DocGate).
