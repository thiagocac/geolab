# CHANGELOG v126 — Campo "Operador (quem rompeu)" como toggle de ensaio

## Frontend
- **Config. de Campos › Ensaio:** novo campo **Operador (quem rompeu)** (`operador`), **desligado por padrão**.
- **Rompimentos:** o seletor de operador só aparece quando o campo está ligado em Config. de Campos › Ensaio.
  Com o campo desligado (padrão), o seletor some e o `operador_id` **não é gravado** (fica nulo), seguindo o
  mesmo padrão dos demais campos opcionais (tipo de ruptura, prensa, capeamento, massa do CP).

## Backend — migration 107 (já aplicada via MCP)
- `docgate_laudo_blocks` passa a emitir os avisos de operador (`operador_nao_informado`,
  `operador_certificacao_vencida`) **somente quando** `config_lab.ensaio_campos->>'operador' = true`.
  Com o campo desligado, esses avisos não aparecem na DocGate — coerente com "operador não rastreado,
  logo não aparece em lugar nenhum". Verificado vivo nos dois sentidos (off: 0 avisos de operador; on: 18).

## Observações
- O laudo (PDF) mostra o **moldador**, não o operador; nada muda no laudo.
- A importação de rompimentos por planilha nunca gravou operador; sem mudança.
- Relatório de Produtividade soma rompimentos por operador quando houver dado; com o campo desligado, não há novo dado.

CACHE_NAME=consultegeo-geolab-v126 · APP_VERSION=v126
