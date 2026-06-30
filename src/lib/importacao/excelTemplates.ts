import { exportExcel, type XlsxColumn } from '../export/xlsx';
import { fieldsForResource, resourceLabel, type ImportField, type ImportResource } from './excelModel';

const colFor = (f: ImportField): XlsxColumn<Record<string, unknown>> => ({ key: f.key, header: f.header, width: Math.max(14, Math.min(28, f.header.length + 3)), format: f.type === 'number' ? 'dec2' : f.type === 'date' ? 'date' : 'text' });

export async function exportBlankImportTemplate(resource: ImportResource, cfg?: Record<string, unknown>): Promise<void> {
  const fields = fieldsForResource(resource, cfg as never);
  const blank = Object.fromEntries(fields.map((f) => [f.key, '']));
  await exportExcel({
    title: 'Modelo de importação - ' + resourceLabel(resource),
    filename: 'modelo-importacao-' + resource + '.xlsx',
    fields: [
      { label: 'Recurso', value: resourceLabel(resource) },
      { label: 'Regra', value: 'Não altere os nomes das colunas. Campos variam conforme Config. de Campos.' },
    ],
  }, [
    { name: 'Dados', template: true, columns: fields.map(colFor), rows: [blank] },
    { name: 'Dicionario', columns: [
      { key: 'header', header: 'coluna', width: 28 },
      { key: 'type', header: 'tipo', width: 12 },
      { key: 'required', header: 'obrigatorio', width: 12 },
      { key: 'hint', header: 'orientacao', width: 48 },
      { key: 'example', header: 'exemplo', width: 24 },
    ], rows: fields.map((f) => ({ ...f, required: f.required ? 'sim' : 'não', hint: f.hint ?? '' })) },
  ]);
}
