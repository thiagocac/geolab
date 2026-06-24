# GEOLAB v41 — Motor de NC (Fase C): mais gatilhos automáticos

**Backend-only.** Sem mudança de frontend → cache permanece `consultegeo-geolab-v40` (nada a rebuildar no Netlify). As NCs geradas aparecem na caixa já existente (Concreto → Não-conformidades).

## O que entra (migration 041, JÁ aplicada via MCP em xbdvyvvxvzmcosnekmfv)
Novos gatilhos automáticos, re-derivados do GEOMAT e adaptados ao GEOLAB:

- **T-14 Calibração vencida** — rompimento com prensa (`material_tests.equipamento_id`) de calibração vencida na data → NC alta.
- **T-05 Slump fora** — recebimento com `slump_medido_cm` fora de `slump_previsto_cm ± tolerância` do traço.
- **T-11 Água adicionada** — água adicionada na obra (NBR 7212).
- **T-01 Concreto vencido** — tempo de transporte > validade (gateado por `nc_parameters.validade_concreto_h`; dormente até configurar).
- **Reversão por contraprova** — contraprova satisfatória (resultado ≥ fck) **conclui automaticamente** as NCs abertas do CP original; insatisfatória registra escalada para tratativa manual.

Junto com o T-02 (resultado < fck na idade de controle) e T-08 (alteração após aceite) da Fase A.

Adaptações vs GEOMAT: `laboratorio_id`→`tenant_id`; `work_id`/traço resolvidos via concretagem; sem flow / volume NF×recebido / desforma (falta de dado no GEOLAB v1).

## Validação
DO + rollback atômico: slump 20 vs 10±2 → T-05; 15 L água → T-11; prensa vencida → T-14; contraprova 33≥30 conclui a NC do original. T-02 não dispara com resultado ≥ fck.

## Pendente (Fase C restante)
RAC + `generate-nc-report-pdf`; telas de configuração (tolerâncias `nc_parameters` / editor de templates); anexos nas ações; CP atrasado→NC (no cron); autoconclusão por tolerância; e-mail de NC.
