# Análise dos dashboards de referência — GEOLAB v134

Fonte analisada: `00 - Novos Dashboards.zip`, extraído com sucesso no container. Foram encontrados 40 arquivos HTML: 1 capa, 19 dashboards de novas ideias e 20 painéis reconstruídos do Power BI. O material foi usado apenas como referência conceitual; nenhum HTML externo foi incorporado ao GEOLAB.

## Síntese da adaptação para laboratório

- O material original é orientado à gestão de concreto por construtoras. No GEOLAB, o tenant é o laboratório, então os painéis foram reinterpretados como gestão de carteira de obras/clientes, operação de moldagem/rompimento, rastreabilidade de laudo, produtividade do laboratório e financeiro de serviços.
- Indicadores úteis: conformidade na idade de controle, backlog de CPs, atrasos de rompimento, laudos pendentes, NCs, calibração/certificação, uso de equipamentos, produtividade da equipe, fornecedores/concreteiras, contratos, medições, recebíveis e risco integrado.
- Indicadores descartados ou rebaixados: módulo de elasticidade como painel v1, comparação entre laboratórios dentro do tenant, reprovação automática por idade menor que a de controle, e vencimento logístico como reprovação técnica automática.

## Análise painel a painel

| Arquivo | O que o dashboard faz | O que é útil ao GEOLAB | Decisão na v134 |
|---|---|---|---|
| `Capa_Monitoramento_Concreto.html` | **Capa executiva de navegação.** Resumo de volume, BTs, obras ativas, reprovação 28d, sem resultado e NCs abertas. Funciona como landing page de decisão. | Útil como visão inicial, mas no laboratório precisa trocar “BTs” por amostras/CPs/laudos e destacar capacidade operacional. | Usado para o painel Executivo do laboratório, cards globais e navegação dos 20 painéis. |
| `00_Resumo_Executivo_4.html` | **Resumo executivo filtrável.** Possui filtros por data/obra/concreteira, alertas e rankings. Traz o padrão de “começar pelo problema e permitir drill-down”. | Muito útil; no laboratório o eixo de concreteira vira fornecedor/rastreabilidade, e o eixo de obra vira cliente/obra do lab. | Virou o cabeçalho de filtros globais dos dashboards GEOLAB e o painel de risco/alertas. |
| `01_Painel_Executivo_Concreto.html` | **Painel executivo de concreto.** KPIs de volume, caminhões, obras, reprovação, sem resultado e bombeados; gráfico de evolução, ranking de concreteiras e scorecard de obras. | Útil; no lab deve medir volume ensaiado, laudos emitidos, conformidade, backlog de rompimentos e receita medida. | Implementado como “Executivo do laboratório”. |
| `02_Scorecard_por_Obra_Concreto.html` | **Scorecard por obra.** Classifica obras dentro da meta, atenção e críticas, com ordenação por volume, reprovação, insatisfatórios e pendências. | Muito útil para laboratório priorizar atendimento e relacionamento com clientes. | Implementado como “Scorecard por obra”. |
| `03_Comparativo_Concreteiras.html` | **Comparativo de concreteiras.** Compara volume, reprovação, BTs, obras, slump NC, não descarregou, radar e tempos. | Útil como ranking de fornecedores; laboratório não controla a usina, mas precisa evidenciar desempenho por fornecedor. | Implementado como “Fornecedores / concreteiras”. |
| `05_Timeline_Concretagem.html` | **Timeline de concretagem.** Mapa de calor por dia/hora, tempos médios, permanência, vencimento e Gantt de caminhões. | Útil para campo e coleta. Para laboratório, o foco é SLA de coleta/recebimento/rompimento/laudo. | Implementado em “Logística do caminhão” e “SLA do laboratório”. |
| `06_Controle_Pendencias.html` | **Controle de pendências.** Mostra sem resultado aos 28d, vencidos, no prazo, contraprovas pendentes, docs pendentes e status geral. | Essencial para operação de laboratório; backlog de CPs e laudos é gargalo diário. | Implementado em “Pendências e lançamentos” e “Agenda de rompimentos”. |
| `07_NCs_Detalhado.html` | **Não conformidades detalhadas.** Total de NCs, abertas, concluídas, tipos, situação e distribuição por obra. | Útil; no GEOLAB NC deve separar resultado abaixo do FCK em idade de controle, slump, CP atrasado, calibração/documento. | Implementado como “Não conformidades”. |
| `08_Ranking_Concreteiras.html` | **Ranking técnico-comercial.** Score composto qualidade, pontualidade e logística; medalhas, indicadores normalizados e recomendações. | Útil com cautela: laboratório pode ranquear fornecedores, mas deve deixar claro que é indicador técnico de amostras recebidas. | Usado no ranking de fornecedores e no risco integrado. |
| `09_Predicao_7d_28d.html` | **Predição 7d→28d.** Correlaciona 7d e 28d, identifica probabilidade de reprovação e ações preventivas. | Útil como tendência; predição estatística real deve ficar v1.1+ para evitar decisão indevida na v1. | Adaptado como curva de resistência/tendência; não reprovamos idades menores. |
| `11_SLA_Rompimento.html` | **SLA de rompimento.** Rastreia prazo entre concretagem e rompimento; mostra SLA, média de dias, sem resultado e vencidos. | Essencial para laboratório, com régua de idade de controle e atraso de lançamento. | Implementado como “SLA do laboratório”. |
| `12_Custo_Nao_Qualidade.html` | **Custo da não qualidade.** Estima impacto financeiro de reprovação, concreto vencido, superdimensionamento e tratativa de NCs. | Útil para direção e comercial; no laboratório vira custo de retrabalho, contraprova, laudo revisado e horas improdutivas. | Implementado em financeiro e risco/custo da não qualidade. |
| `13_Financeiro_Centro_Custo.html` | **Financeiro por centro de custo.** Prepara análise financeira por centro, valor unitário e nota fiscal; no exemplo os campos estavam vazios. | Útil, mas precisa ser remodelado para o lab: contrato, obra, preço por ensaio, medição, fatura e recebimento. | Originou a central Contratos e financeiro. |
| `N01_Score_Risco_Integrado.html` | **Score de risco integrado por obra.** Integra qualidade, prazo, pendência e criticidade por obra. | Muito útil para priorização gerencial do laboratório. | Implementado como “Risco integrado”. |
| `N02_Tendencias_Projecoes.html` | **Tendências e projeções.** Projeções de volume/risco e tendência temporal. | Útil em nível gerencial; previsões avançadas ficam como evolução, mas tendência simples é segura. | Usado nas séries temporais de volume, conformidade, laudos e SLA. |
| `N03_Correlacao_Qualidade_Logistica.html` | **Correlação qualidade × logística.** Relaciona atrasos, tempos, slump, temperatura e qualidade. | Muito útil para detectar causa provável de resultado insatisfatório ou desvio operacional. | Implementado como painéis de slump, logística e risco. |
| `N04_Eficiencia_Logistica.html` | **Eficiência logística por obra.** Avalia permanência, transporte, descarga e atraso por obra. | Útil para campo e produtividade; no lab ajuda a melhorar agenda e deslocamento. | Implementado em “Logística do caminhão”. |
| `N05_Perfil_Concreto.html` | **Perfil de consumo por obra.** FCK, traço, volume, slump e perfil de uso por obra. | Útil para laboratório entender mix de ensaios e demanda futura. | Implementado em scorecard de obras, perfil de FCK e contratos/medição. |
| `N06_Heatmap_FCK_Obra_Lab_Concreteira.html` | **Heatmap FCK × obra/usina/lab.** Mapa de calor de reprovação por FCK, obra, usina e laboratório. | Muito útil; adaptado para FCK × obra × fornecedor, com cuidado para não confundir “laboratório” como fornecedor. | Implementado em qualidade/variação e risco integrado. |
| `N13_Gestao_Integrada_Usinas_Lab_Criticidade.html` | **Gestão integrada de criticidade.** Filtros por idade, obra, usina, laboratório e FCK, com criticidade 28d e contraprova. | Útil para priorização técnica. No GEOLAB, idade de controle é regra central. | Usado em risco integrado e insatisfatórios. |
| `P01_Indicadores_Resistencia.html` | **Indicadores de resistência.** Filtros por obra, concreteira, FCK, classificação e período; foca KPIs de resistência. | Essencial; deve respeitar maior valor do par e idade de controle. | Implementado em “Qualidade e aceitação”. |
| `P02_Detalhe_Insatisfatorios.html` | **Detalhe insatisfatórios 28d.** Drill-down dos resultados abaixo de referência aos 28 dias. | Essencial; na v1 só idade de controle reprova. | Implementado em “Resultados insatisfatórios”. |
| `P03_Altas_Resistencias.html` | **Altas resistências.** Identifica resultados muito acima do FCK. | Útil para discutir traços conservadores e custo do concreto com cliente/fornecedor. | Implementado em “Altas resistências”. |
| `P04_Resistencia_Todas_Idades.html` | **Resistência em todas as idades.** Analisa idades menores e 28d com filtros de acima/abaixo. | Útil como acompanhamento; idades menores não podem reprovar. | Implementado em “Curva de resistência”. |
| `P05_Variacao_Resistencia.html` | **Amplitude/desvio padrão.** Desvio, amplitude e dispersão por obra/concreteira/FCK/idade. | Útil para estabilidade do processo e identificação de variabilidade. | Implementado em “Variação e dispersão”. |
| `P06_Modulo_Elasticidade.html` | **Módulo de elasticidade.** Painel de ensaio diferente da compressão NBR 5739. | Não entra na v1; útil para v1.1+ multi-ensaio. | Não implementado como painel próprio; registrado como futuro. |
| `P07_Concreteiras_Laboratorios.html` | **Concreteiras e laboratórios.** Compara fornecedor e laboratório por classificação/período. | Parcial: no GEOLAB cada tenant é laboratório; comparação entre labs não cabe no tenant. | Adaptado para fornecedores e produtividade interna. |
| `P08_Evolucao_Volumes.html` | **Evolução de volumes.** Volume lançado e número de concretagens ao longo do tempo. | Útil para demanda operacional, capacidade e faturamento. | Implementado em Executivo, obras e financeiro. |
| `P09_Detalhamento_Horarios.html` | **Detalhamento de horários.** Chegada/saída/após 18h e comportamento por período. | Útil para operação de campo, escala de equipe e SLA. | Implementado em logística e produtividade. |
| `P10_Tempo_Permanencia.html` | **Tempo de permanência por caminhão.** Meta de permanência, acima/abaixo, por obra/concreteira. | Útil como indicador de logística e risco de atraso no ensaio. | Implementado em logística. |
| `P11_Vencimento_Concreto.html` | **Tempo total/vencimento do concreto.** Meta de tempo total até lançamento/descarga. | Útil com cautela: o lab registra, mas não deve transformar automaticamente em reprovação técnica. | Implementado como risco logístico, não como reprovação automática. |
| `P12_Analise_Atrasos.html` | **Programado × entregue.** Atrasos maiores que 30 min e variação entre programação e entrega. | Útil para agenda, alocação de moldador e gestão do cliente. | Implementado em SLA e pendências. |
| `P13_Tempo_Concretagem.html` | **Tempo de concretagem.** Duração do evento de concretagem. | Útil para produtividade de campo e dimensionamento da equipe. | Implementado em logística/campo. |
| `P14_Nao_Conformidades.html` | **Análise de não conformidades.** Status abertas/concluídas e filtros por obra/concreteira. | Essencial para qualidade e rastreabilidade. | Implementado como painel NC. |
| `P15_1_Flow.html` | **Flow operacional.** Fluxo do processo de concretagem e etapas. | Muito útil; no lab vira fluxo programação→moldagem→recebimento→rompimento→laudo. | Implementado em SLA, pendências e risco. |
| `P15_Slump.html` | **Análise de slump.** Slump de referência, realizado, classificação e filtros. | Essencial para recebimento e possível NC de campo. | Implementado em “Slump e recebimento”. |
| `P16_Medicao_Concreto.html` | **Medição de concreto.** Medido por volume/serviço/período. | Útil, mas adaptado para medição de serviços do laboratório, não faturamento por m³ do concreto. | Implementado em Contratos e medição. |
| `P17_Previsto_Realizado.html` | **Previsto × realizado.** Compara volume previsto e realizado. | Útil para carteira/contrato e programação de capacidade do laboratório. | Implementado em financeiro/contratos. |
| `P18_Uso_por_Obra.html` | **Uso por obra.** Controle de uso e consumo por obra. | Útil para scorecard por obra e curva de demanda. | Implementado em Scorecard por obra. |
| `P19_Pendencias_Lancamentos.html` | **Pendências de lançamentos.** Identifica registros sem lançamento/sem fechamento. | Essencial para importação Excel e fechamento operacional. | Implementado em importação Excel e pendências. |

## Painéis GEOLAB resultantes

A v134 consolida os aprendizados em 20 painéis próprios do laboratório: Executivo, Qualidade, Agenda de Rompimentos, Curva de Resistência, Insatisfatórios, Altas Resistências, Variação, Slump, Fornecedores, Obras, Logística, SLA, Pendências, NC, Documentos/Gate, Equipamentos, Produtividade, Financeiro, Contratos/Medição e Risco Integrado.

## Regras de domínio preservadas

- Idade de controle é a única idade que define aceitação/reprovação.
- Resistência do exemplar é maior valor do par.
- CP físico e resultado ensaiado permanecem entidades separadas.
- Volume de caminhão é rastreabilidade operacional, não faturamento automático.
- Contratos/financeiro tratam serviços do laboratório: ensaio, laudo, visita, deslocamento, forma, medição e cobrança.
- Importação Excel exige validação antes do commit e deve manter lote auditável.
