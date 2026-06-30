# CHANGELOG v125 — Config. de Campos unificada + limpeza de Preferências

## Headline (v125)
- **Nova tela `Config. de Campos`** (`/gestao/config-campos`, `ConfigCamposPage`) com 4 abas no topo —
  **Ensaio · Laudo · Recebimento · Concretagem** — cada uma com seu checklist e botão Salvar. Uma única
  query do `config_lab`; salva apenas a coluna da aba ativa (`ensaio_campos`/`laudo_campos`/
  `recebimento_campos`/`concretagem_campos`) e invalida o consumidor certo (rompimentos/laudos/concretagem).
- **Menu lateral:** os 3 itens (Campos do ensaio e laudo, Campos recebimento, Campos concretagem) viraram
  **1 item "Config. de Campos"**. As rotas antigas (`/gestao/controle-laudo`, `/gestao/campos-recebimento`,
  `/gestao/campos-concretagem`) **redirecionam** para a aba correspondente (sem 404).
- **Preferências:** removido o card "Campos exibidos no laudo" (era duplicata das mesmas chaves de
  `laudo_campos`); agora os campos do laudo vivem só na aba Laudo. Preferências mantém RT/acreditação/logo/
  idade de controle. Um aviso aponta para o novo lugar.
- **Catálogo (`camposEnsaioLaudo.ts`):** defaults de recebimento/concretagem **alinhados ao consumidor (EF)**
  — antes a tela mostrava alguns campos como "off" enquanto o laudo os desenhava (só afetava tenants sem
  config salva; LabTest já tinha tudo salvo). Hints adicionados e rótulo de acreditação ajustado (CGCRE/INMETRO).

## Revisão de funcionamento dinâmico (verificado)
- **Ensaio** → tela de Rompimentos (colunas tipo_ruptura/prensa/capeamento/massa) reagem a `ensaio_campos`.
- **Laudo** → EF `generate-laudo-ensaio-pdf` (26 chaves; defaults batem com o catálogo).
- **Recebimento/Concretagem** → tela de Concretagem + ficha + laudo (EF). NF/série e fck/traço são núcleo (sempre on).

## Cumulativo
Inclui ondas 1-4 + fix de pop-up (v124). Bump sw.js + core.ts → v125. Backend (093-106 + EFs) já aplicado via MCP.
