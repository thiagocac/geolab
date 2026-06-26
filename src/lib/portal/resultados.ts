// Helpers puros do portal (sem dependencia de Supabase): filtros, consolidacao por
// exemplar, deteccao de atraso e exportadores Excel/PDF. Reusados pelos dois portais.
import type { ExemplarResumo, LaudoFiltro, ParcialFinal, PortalLaudoView, PortalResultadoRow, ResultadoFiltro } from './types';
import { exportExcel, type XlsxColumn } from '../export/xlsx';

const norm = (v: unknown) => String(v ?? '').toLowerCase();
export const hojeISO = () => new Date().toISOString().slice(0, 10);

export function parcialFinalMeta(value: ParcialFinal): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (value === 'final') return { label: 'Final', tone: 'success' };
  if (value === 'parcial') return { label: 'Parcial', tone: 'warning' };
  return { label: 'Sem resultados', tone: 'neutral' };
}

// CP atrasado: pendente, sem resultado e com data prevista de rompimento ja vencida.
export function isAtrasado(r: PortalResultadoRow, hoje = hojeISO()): boolean {
  return r.resultado_valor == null && r.situacao === 'pendente' && !!r.data_prevista_rompimento && r.data_prevista_rompimento < hoje;
}

export function filtraLaudos(laudos: PortalLaudoView[], f: LaudoFiltro): PortalLaudoView[] {
  const t = f.texto.trim().toLowerCase();
  return laudos.filter((l) => {
    if (f.workId && l.work_id !== f.workId) return false;
    if (f.tipo !== 'todos' && l.parcial_final !== f.tipo) return false;
    if (f.status && l.status !== f.status) return false;
    if (f.de && (!l.data_emissao || l.data_emissao < f.de)) return false;
    if (f.ate && (!l.data_emissao || l.data_emissao > f.ate)) return false;
    if (t && !(norm(l.numero).includes(t) || norm(l.work_nome).includes(t))) return false;
    return true;
  });
}

export function filtraResultados(rows: PortalResultadoRow[], f: ResultadoFiltro): PortalResultadoRow[] {
  const t = f.texto.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.workId && r.work_id !== f.workId) return false;
    if (f.somenteComResultado && r.resultado_valor == null) return false;
    if (f.idade === 'controle' && !r.is_controle) return false;
    if (f.idade === 'acompanhamento' && r.is_controle) return false;
    if (f.conformidade === 'conforme' && r.conforme !== true) return false;
    if (f.conformidade === 'nao_conforme' && r.conforme !== false) return false;
    if (f.de && (!r.data_rompimento || r.data_rompimento < f.de)) return false;
    if (f.ate && (!r.data_rompimento || r.data_rompimento > f.ate)) return false;
    if (t) {
      const hay = [r.concretagem_codigo, r.local_texto, r.nota_fiscal, r.cp_codigo, r.numeracao_lab, r.work_nome, r.amostra_codigo].map(norm).join(' ');
      if (!hay.includes(t)) return false;
    }
    return true;
  });
}

// Resistencia do exemplar = MAIOR do par na idade de controle (NBR 5739, tipo_resultado_consolidado=maximo).
export function consolidarExemplares(rows: PortalResultadoRow[]): ExemplarResumo[] {
  const groups = new Map<string, PortalResultadoRow[]>();
  for (const r of rows) {
    const key = (r.concretagem_id ?? '') + '|' + (r.amostra_id ?? r.cp_id);
    const arr = groups.get(key);
    if (arr) arr.push(r); else groups.set(key, [r]);
  }
  const out: ExemplarResumo[] = [];
  for (const arr of groups.values()) {
    const controle = arr.filter((r) => r.is_controle && r.resultado_valor != null);
    const ref = arr[0];
    const resist = controle.length ? Math.max(...controle.map((r) => Number(r.resultado_valor))) : null;
    const fck = ref.fck_ref ?? ref.fck_previsto ?? null;
    const conforme = resist == null || fck == null ? null : resist >= fck;
    out.push({
      concretagem_codigo: ref.concretagem_codigo, work_nome: ref.work_nome, data: ref.data_concretagem,
      exemplar: ref.amostra_codigo, nf: ref.nota_fiscal,
      idade_controle: controle[0]?.idade_controle ?? ref.idade_controle ?? null,
      resistencia: resist, fck, conforme, n_cps: arr.length,
    });
  }
  return out;
}

const conformeTxt = (v: boolean | null) => (v == null ? '' : v ? 'Conforme' : 'Não conforme');

export async function exportResultadosXlsx(rows: PortalResultadoRow[], filename: string): Promise<void> {
  const resumo = consolidarExemplares(rows);
  const colsResumo: XlsxColumn<ExemplarResumo>[] = [
    { key: 'work_nome', header: 'Obra', width: 24 },
    { key: 'concretagem_codigo', header: 'Concretagem', width: 18 },
    { key: 'data', header: 'Data', format: 'date' },
    { key: 'exemplar', header: 'Exemplar', align: 'center' },
    { key: 'nf', header: 'NF', align: 'center' },
    { key: 'idade_controle', header: 'Idade controle (dias)', format: 'int' },
    { key: 'resistencia', header: 'Resistência (MPa)', format: 'dec1' },
    { key: 'fck', header: 'FCK (MPa)', format: 'dec1' },
    { header: 'Conforme', align: 'center', map: (e) => conformeTxt(e.conforme) },
    { key: 'n_cps', header: 'Nº CPs', format: 'int' },
  ];
  const colsDetalhe: XlsxColumn<PortalResultadoRow>[] = [
    { key: 'work_nome', header: 'Obra', width: 24 },
    { key: 'concretagem_codigo', header: 'Concretagem', width: 18 },
    { key: 'data_concretagem', header: 'Data', format: 'date' },
    { key: 'fornecedor_texto', header: 'Fornecedor', width: 18 },
    { key: 'local_texto', header: 'Local / peça', width: 16 },
    { key: 'nota_fiscal', header: 'NF', align: 'center' },
    { key: 'amostra_codigo', header: 'Exemplar', align: 'center' },
    { header: 'CP', align: 'center', map: (r) => r.cp_codigo ?? r.numeracao_lab ?? '' },
    { key: 'idade_dias', header: 'Idade (dias)', format: 'int' },
    { key: 'data_rompimento', header: 'Data rompimento', format: 'date' },
    { key: 'carga_ruptura_kn', header: 'Carga (kN)', format: 'dec1' },
    { key: 'resultado_valor', header: 'Resultado (MPa)', format: 'dec1' },
    { key: 'fck_ref', header: 'FCK (MPa)', format: 'dec1' },
    { key: 'idade_controle', header: 'Idade controle (dias)', format: 'int' },
    { header: 'Idade de controle?', align: 'center', map: (r) => (r.is_controle ? 'Sim' : 'Não') },
    { header: 'Conforme', align: 'center', map: (r) => conformeTxt(r.conforme) },
    { key: 'situacao', header: 'Situação', align: 'center' },
  ];
  await exportExcel(
    { title: 'Resultados de ensaios', filename, fields: [{ label: 'Exemplares', value: String(resumo.length) }, { label: 'Corpos de prova', value: String(rows.length) }] },
    [
      { name: 'Resumo por exemplar', columns: colsResumo, rows: resumo },
      { name: 'Detalhe por CP', columns: colsDetalhe, rows },
    ],
  );
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
const cell = (v: unknown) => '<td>' + esc(v) + '</td>';

// Exporta PDF via impressao do navegador (sem dependencia nova). Abre aba e dispara print.
export function exportResultadosPdf(rows: PortalResultadoRow[], titulo: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  const resumo = consolidarExemplares(rows);
  const resumoHtml = resumo.map((e) => '<tr>' + [e.work_nome, e.concretagem_codigo, e.data, e.exemplar, e.nf, e.idade_controle, e.resistencia ?? '—', e.fck ?? '—', conformeTxt(e.conforme)].map(cell).join('') + '</tr>').join('');
  const detalheHtml = rows.map((r) => '<tr>' + [r.concretagem_codigo, r.nota_fiscal, r.amostra_codigo, r.cp_codigo ?? r.numeracao_lab, (r.idade_dias ?? '') + (r.idade_unidade === 'hora' ? 'h' : 'd'), r.data_rompimento, r.resultado_valor ?? '—', r.fck_ref ?? '—', conformeTxt(r.conforme)].map(cell).join('') + '</tr>').join('');
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>'
    + '<style>body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 6px}p{color:#64748b;font-size:11px;margin:0 0 8px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body>'
    + '<h1>' + esc(titulo) + '</h1><p>Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + ' — ' + rows.length + ' corpos de prova · ' + resumo.length + ' exemplares</p>'
    + '<button onclick="window.print()">Imprimir / Salvar PDF</button>'
    + '<h2>Resumo por exemplar</h2><table><thead><tr><th>Obra</th><th>Concretagem</th><th>Data</th><th>Exemplar</th><th>NF</th><th>Idade ctrl</th><th>Resist. (MPa)</th><th>FCK</th><th>Conforme</th></tr></thead><tbody>' + resumoHtml + '</tbody></table>'
    + '<h2>Detalhe por CP</h2><table><thead><tr><th>Concretagem</th><th>NF</th><th>Exemplar</th><th>CP</th><th>Idade</th><th>Rompimento</th><th>Resultado</th><th>FCK</th><th>Conforme</th></tr></thead><tbody>' + detalheHtml + '</tbody></table>'
    + '<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>';
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
