# CHANGELOG v132 — Numeração de CP manual na moldagem (toggle + gerar sequência)

Alguns laboratórios mantêm uma numeração interna sequencial dos corpos de prova
(impressa/escrita no CP físico). A v131 já permitia registrá-la por CP **na tela de
Rompimentos**; a v132 traz a numeração para o **momento da moldagem** (Caminhões + CPs),
com preenchimento manual e geração automática da sequência. Frontend-only — a coluna
`corpos_prova.numeracao_lab` já existia (reaproveitada; aparece em rompimento, laudo e portal).

## Frontend
- **Config. de Campos › Recebimento:** novo toggle **"Numeração de CP manual (laboratório)"**
  (`recebimento_campos.numeracao_cp_manual`), **DESMARCADO por padrão** (opt-in). A aba já
  itera o catálogo, então o checkbox aparece e funciona dinamicamente.
- **Concretagem › Caminhões + CPs (modal "Adicionar caminhão + CPs"):** quando o toggle está
  ligado, aparece o bloco **"Numeração dos corpos de prova"**:
  - um campo de numeração por CP (CPs ordenados por **idade crescente** — o 1º é o de menor idade de controle);
  - campo **"Nº do 1º CP"** + botão **"Gerar numeração"**: digita-se a numeração do primeiro CP e o
    sistema preenche a sequência (incrementa o último grupo de dígitos preservando prefixo/sufixo e
    zero-padding: `1235689 → 1235690…`, `A-099 → A-100…`, `0001 → 0002…`);
  - tudo é editável manualmente antes de salvar.
- **Persistência:** `addCaminhao` grava `numeracao_lab` em cada CP, alinhada à ordem de criação.
  Sem numeração informada → `null` (comportamento atual inalterado). Os cards de CP na etapa 2
  passam a exibir o `Nº` quando houver.

## Núcleo
- `concreto.ts`: helper puro **`bumpNumeracao(base, step)`** (BigInt) + teste `concreto.numeracao.test.ts` (12 casos).
- `camposEnsaioLaudo.ts`: `CAMPOS_RECEBIMENTO += numeracao_cp_manual` (on:false).
- `api/concretagem.ts`: `addCaminhao` aceita `values.numeracoes[]`; `listCpsDaConcretagem`/`CpDetalhe += numeracao_lab`.

## Backend
- **Sem mudança.** Coluna `corpos_prova.numeracao_lab` (text, nullable) já existe; nenhuma migration/EF.

CACHE_NAME=consultegeo-geolab-v132 · APP_VERSION=v132
