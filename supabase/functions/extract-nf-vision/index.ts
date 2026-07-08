// extract-nf-vision (GEOLAB) - OCR por IA da DANFE/NF do caminhao (ou NF-e XML) -> campos de material_receipts.
// Re-derivado do GEOMAT (extract-nf-vision), adaptado ao padrao GEOLAB (auth de member, env VISION_API_KEY/URL/MODEL,
// FAIL-SAFE sem chave). Saida { ok, enabled, _source, dados:{ nota_fiscal, serie, placa, motorista, volume_m3,
// fornecedor, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, slump_medido_cm, temperatura_concreto_c } }.
// Aceita { image_base64, mime } (DANFE) ou { xml } (NF-e). Corpo deployado via MCP (slug extract-nf-vision, sha 36f33ccc...).
