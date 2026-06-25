# GEOLAB — Melhorias dos Processos Essenciais (overlay v1)

Overlay pelos **caminhos reais do repo** das **9 melhorias** dos Processos 1–3 (Ficha, Rompimentos, Laudos).
Alvo: **GEOLAB** (`xbdvyvvxvzmcosnekmfv`). Implementado do zero / por analogia ao GEOCON — **GEOMAT não foi usado**.

> **Nada aqui foi aplicado em produção.** Migrations e EFs devem ser aplicadas/deployadas por você
> (workflow do projeto: via MCP, *uma alteração por vez*). Os schemas usados foram conferidos por
> introspecção **read-only** do banco vivo.

---

## 1. Inventário

### Migrations (`supabase/migrations/`) — aplicar nesta ordem
| Arquivo | Melhoria | O que faz |
|---|---|---|
| `053_evidencias.sql` | 1.2 | Tabela `evidencias` + RLS (`is_tenant_member`/`is_tenant_writer`) + storage policy no bucket `evidencias`. |
| `054_magic_link_aprovacao_laudo.sql` | 3.2 | `criar_magic_link` recriada com whitelist `('portal','aprovacao_laudo')` + nova `consume_magic_link_laudo(token,decision,comment)` (one-time, `for update`). |
| `055_evento_laudo_cliente.sql` | 3.1 | Registra o `event_type` `laudo_disponivel_cliente` no catálogo (sem FK; opcional). |

### Edge Functions (`supabase/functions/<nome>/index.ts`) — deploy + `config.toml`
| EF | `verify_jwt` | Melhoria | O que faz |
|---|---|---|---|
| `extract-ficha-vision` | **true** | 1.1 | OCR da ficha de moldagem fotografada → caminhões detectados. Fail-safe sem `VISION_API_KEY`. |
| `generate-ficha-moldagem-pdf` | (mantém) | 1.1 | **Atualizada**: desenha o **QR** (`concretagem_id`) no topo da 1ª página. |
| `approve-laudo-link` | **false** (pública) | 3.2 | Recebe `{token,decision,comment}` → `consume_magic_link_laudo` via service-role. |
| `enviar-laudo-cliente` | **true** | 3.1 | Envia o laudo emitido ao cliente (`lab_clients.email`) **com o PDF anexado**; respeita o dispatch e loga. |

> Snippets de `config.toml` inclusos: `config.toml.<nome>.snippet`.

### Frontend (`src/`)
| Arquivo | Melhoria | O que muda |
|---|---|---|
| `src/pages/concreto/RompimentosPage.tsx` | 2.1, 2.2, 2.3 | fck reprova só na idade de controle + faixa de MPa + aviso de calibração; legenda ruptura A–F + incerteza ±; "aplicar a N selecionados". |
| `src/pages/concreto/ConcretagemDetalhePage.tsx` | 1.1, 1.2 | Card de **Evidências** (upload + galeria) + modal **"Conferir ficha preenchida"** (OCR → criar caminhões idempotentes). |
| `src/lib/api/concretagem.ts` | 1.1, 1.2 | `uploadEvidencia`/`listEvidencias`/`signedEvidencia`/`excluirEvidencia` + `lerFichaImagem` + tipos. |
| `src/pages/concreto/LaudosPage.tsx` | 3.1, 3.2, 3.3 | Multisseleção + **Pré-visualizar** + **Gerar em lote**; botões **"Link aprovação"** e **"Enviar ao cliente"**. |
| `src/lib/api/laudo.ts` | 3.1, 3.2, 3.3 | `gerarLaudo(concId, persist)` + `criarLinkAprovacao` + `decidirLaudoLink` + `enviarLaudoCliente`. |
| `src/pages/LaudoAprovarPage.tsx` | 3.2 | **Nova** página **pública** `/laudo/aprovar/:token` (Aprovar/Devolver/Reprovar + comentário). |
| `src/App.tsx` | 3.2 | Bloco de rota **pública** `/laudo/aprovar` (fora do gate, espelhando `/validar`). |

> **2.4 (import XLSX)** já existia no v57 — nada a aplicar.

---

## 2. Ordem de aplicação

1. **Migrations** (MCP `apply_migration`, em ordem): `053` → `054` → `055`.
2. **Deploy das EFs** + adicionar as entradas ao `supabase/config.toml`:
   - `extract-ficha-vision` (`verify_jwt = true`)
   - `approve-laudo-link` (`verify_jwt = false`)
   - `enviar-laudo-cliente` (`verify_jwt = true`)
   - `generate-ficha-moldagem-pdf` (substituir pelo arquivo com QR)
3. **Frontend**: sobrepor os arquivos de `src/` listados acima.
4. **Regenerar `src/lib/database.types.ts`** (nova tabela `evidencias`).
5. **Destravadores externos** (sem eles, OCR e e-mail ficam *armados/ociosos* — degradação graciosa):
   - **G1 (vault):** `VISION_API_KEY` (OCR), `RESEND_FROM_EMAIL` (e-mail ao cliente). `RESEND_API_KEY` já está no vault.
   - **H3 (`notification_dispatch_settings`):** hoje `dispatch_enabled=false`, `dry_run=true`, allowlist `[thiago@consultegeo.com.br]`. Para enviar de verdade: `dispatch_enabled=true`, `dry_run=false` e ajustar a allowlist.

---

## 3. Validação

- **SQL**: `pglast` OK em `053`/`054`/`055`.
- **TS/TSX/EFs**: `esbuild` OK em todos.
- **Schemas**: conferidos por introspecção read-only (magic_links, lab_reports, notification_*, lab_clients, buckets).
- **Não houve execução em runtime** (sem Deno/conexão de app no ambiente de build).

---

## 4. Ressalvas honestas

- **Numeração das migrations**: `053`–`055` seguem o **pacote de observabilidade** (`048`–`052`). Se for aplicar as
  melhorias **sem** a observabilidade, renumere para o próximo slot livre do repo (o source vai até `047`).
- **`App.tsx`**: este arquivo é a versão **só-melhorias** (v57 + bloco `/laudo/aprovar`). Se você também aplicar a
  observabilidade, ela adiciona a rota `/observabilidade` — as duas edições são **independentes** (combine as duas).
- **`generate-ficha-moldagem-pdf`**: o QR está sobre o source v57 (`Deno.serve`). Se aplicar a observabilidade,
  esta EF também recebe o wrap `serveWithTelemetry` (Camada 6) — **sem conflito** (edições independentes).
- **`extract-ficha-vision`**: usa endpoint de visão OpenAI-compatível (`VISION_API_URL`/`VISION_API_MODEL`). Se a sua
  `extract-nf-vision` deployada usa outro provedor, reconcilie só o bloco `fetch(...)` + o parse de
  `choices[0].message.content`.
- **3.2 `reprovar`**: não há status `reprovado` no schema; `reprovar` marca `em_revisao` com justificativa
  `[REPROVADO] …` (evita status órfão). `aprovar→emitido`, `devolver→em_revisao`.
- **3.1 envio**: anexa o **PDF** (não usa link) porque não há rota pública `/portal/m` nem download anônimo do laudo.
  Se preferir delegar ao `send-notification` deployado, troque o bloco Resend por uma chamada a ele (o gating/log já
  seguem `notification_dispatch_settings`/`notification_dispatch_log`).
- **Write-back do nº de laboratório do CP via OCR** ficou **adiado** (precisa de coluna ainda não definida).

---

## 5. Relação com a observabilidade (pacote v58)

São **frentes independentes**. Se aplicar ambas: migrations da observabilidade (`048`–`052`) **antes** das melhorias
(`053`–`055`); e os dois arquivos que ambas tocam — `App.tsx` e `generate-ficha-moldagem-pdf` — combinam sem conflito
(adições independentes), conforme as ressalvas acima.
