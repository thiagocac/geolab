# GEOLAB v47 — OCR de DANFE/NF por caminhão

Complementa o OCR da ficha (`extract-laudo-vision`). Lê a nota fiscal do caminhão por foto e pré-preenche o recebimento.

## Backend (EF nova, JÁ deployada via MCP)
- **`extract-nf-vision`** (v1, verify_jwt=true, sha 36f33ccc) — re-derivada do GEOMAT, padrão GEOLAB (auth de member, **fail-safe** sem `VISION_API_KEY`). Aceita `{ image_base64, mime }` (foto da DANFE) ou `{ xml }` (NF-e). Retorna `dados` com campos já nomeados para o recebimento: nota_fiscal, serie, placa, motorista, volume_m3, fornecedor, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, slump_medido_cm, temperatura_concreto_c. **Ociosa para foto até o `VISION_API_KEY` estar no vault** (a leitura de NF-e XML funciona sem chave).

## Frontend (vai pro GitHub)
- src/lib/api/concretagem.ts — `lerNfImagem(file)` (foto→base64→EF).
- src/pages/concreto/ConcretagemDetalhePage.tsx — botão **"Ler NF (foto)"** no topo do formulário do caminhão (etapa 2): lê a foto e preenche os campos para conferência antes de salvar.
- public/sw.js + src/lib/telemetry/core.ts — bump **v47**.

## Como usar
Concretagem → etapa 2 (caminhões) → "Adicionar caminhão" → **Ler NF (foto)** → fotografar a DANFE → os campos (NF, placa, volume, horários, slump…) vêm preenchidos para revisão. Salvar normalmente.

## Passos
1. Subir o frontend no GitHub. Backend já deployado.
2. Confirmar CACHE_NAME=`consultegeo-geolab-v47` / APP_VERSION=`v47`.
3. Para ativar a leitura por foto: `VISION_API_KEY` no vault (mesma chave do OCR da ficha).

## Build
check-source OK · tsc(0) · vitest(1/1) · vite build OK.
