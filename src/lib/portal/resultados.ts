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

export const situacaoTxt = (s: string | null) => { const m: Record<string, string> = { pendente: 'Pendente', rompido: 'Rompido', descartado: 'Descartado', recebido: 'Recebido' }; return s ? (m[s] ?? s) : ''; };
export const idadeTxt = (r: PortalResultadoRow) => String(r.idade_dias ?? '') + (r.idade_unidade === 'hora' ? 'h' : 'd');

// Detalhe por CP = TODOS os corpos de prova, sem consolidar (inclui pendentes). Resumo por exemplar vai como aba secundaria.
export async function exportResultadosXlsx(rows: PortalResultadoRow[], filename: string): Promise<void> {
  const resumo = consolidarExemplares(rows.filter((r) => r.resultado_valor != null));
  const colsDetalhe: XlsxColumn<PortalResultadoRow>[] = [
    { key: 'work_nome', header: 'Obra', width: 24 },
    { key: 'concretagem_codigo', header: 'Concretagem', width: 18 },
    { key: 'data_concretagem', header: 'Data', format: 'date' },
    { key: 'fornecedor_texto', header: 'Fornecedor', width: 16 },
    { key: 'local_texto', header: 'Local / pe\u00e7a', width: 18 },
    { key: 'elementos_concretados', header: 'Elementos concretados', width: 22 },
    { key: 'nota_fiscal', header: 'NF', align: 'center' },
    { key: 'serie', header: 'S\u00e9rie', align: 'center' },
    { key: 'amostra_codigo', header: 'Exemplar', align: 'center' },
    { header: 'CP', align: 'center', map: (r) => r.cp_codigo ?? r.numeracao_lab ?? '' },
    { key: 'data_moldagem', header: 'Moldagem', format: 'date' },
    { header: 'Idade', align: 'center', map: (r) => idadeTxt(r) },
    { key: 'data_rompimento', header: 'Rompimento', format: 'date' },
    { key: 'carga_ruptura_kn', header: 'Carga (kN)', format: 'dec1' },
    { key: 'resultado_valor', header: 'Resultado (MPa)', format: 'dec1' },
    { key: 'fck_ref', header: 'FCK (MPa)', format: 'dec1' },
    { key: 'idade_controle', header: 'Idade controle (dias)', format: 'int' },
    { header: 'Idade de controle?', align: 'center', map: (r) => (r.is_controle ? 'Sim' : 'N\u00e3o') },
    { header: 'Situa\u00e7\u00e3o', align: 'center', map: (r) => situacaoTxt(r.situacao) },
    { header: 'Conforme', align: 'center', map: (r) => (r.is_controle ? conformeTxt(r.conforme) : 'acompanhamento') },
  ];
  const colsResumo: XlsxColumn<ExemplarResumo>[] = [
    { key: 'work_nome', header: 'Obra', width: 24 },
    { key: 'concretagem_codigo', header: 'Concretagem', width: 18 },
    { key: 'data', header: 'Data', format: 'date' },
    { key: 'exemplar', header: 'Exemplar', align: 'center' },
    { key: 'nf', header: 'NF', align: 'center' },
    { key: 'idade_controle', header: 'Idade controle (dias)', format: 'int' },
    { key: 'resistencia', header: 'Resist\u00eancia (MPa)', format: 'dec1' },
    { key: 'fck', header: 'FCK (MPa)', format: 'dec1' },
    { header: 'Conforme', align: 'center', map: (e) => conformeTxt(e.conforme) },
    { key: 'n_cps', header: 'N\u00ba CPs', format: 'int' },
  ];
  await exportExcel(
    { title: 'Resultados de ensaios \u2014 detalhado por CP', filename, fields: [{ label: 'Corpos de prova', value: String(rows.length) }, { label: 'Exemplares', value: String(resumo.length) }] },
    [
      { name: 'Detalhe por CP', columns: colsDetalhe, rows },
      { name: 'Resumo por exemplar', columns: colsResumo, rows: resumo },
    ],
  );
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
const cell = (v: unknown) => '<td>' + esc(v) + '</td>';

// PDF (impressao do navegador): detalhe de TODOS os CPs primeiro; resumo por exemplar ao final.
export function exportResultadosPdf(rows: PortalResultadoRow[], titulo: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  const resumo = consolidarExemplares(rows.filter((r) => r.resultado_valor != null));
  const detalheHtml = rows.map((r) => '<tr>' + [r.work_nome, r.concretagem_codigo, r.local_texto, r.elementos_concretados, r.nota_fiscal, r.amostra_codigo, r.cp_codigo ?? r.numeracao_lab, idadeTxt(r), r.data_rompimento, r.resultado_valor ?? '\u2014', r.fck_ref ?? '\u2014', situacaoTxt(r.situacao), r.is_controle ? conformeTxt(r.conforme) : 'acomp.'].map(cell).join('') + '</tr>').join('');
  const resumoHtml = resumo.map((e) => '<tr>' + [e.work_nome, e.concretagem_codigo, e.data, e.exemplar, e.nf, e.idade_controle, e.resistencia ?? '\u2014', e.fck ?? '\u2014', conformeTxt(e.conforme)].map(cell).join('') + '</tr>').join('');
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>'
    + '<style>body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 6px}p{color:#64748b;font-size:11px;margin:0 0 8px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body>'
    + '<h1>' + esc(titulo) + '</h1><p>Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + ' \u2014 ' + rows.length + ' corpos de prova \u00b7 ' + resumo.length + ' exemplares</p>'
    + '<button onclick="window.print()">Imprimir / Salvar PDF</button>'
    + '<h2>Detalhe por corpo de prova (todos)</h2><table><thead><tr><th>Obra</th><th>Concretagem</th><th>Local / pe\u00e7a</th><th>Elementos</th><th>NF</th><th>Exemplar</th><th>CP</th><th>Idade</th><th>Rompimento</th><th>Resultado</th><th>FCK</th><th>Situa\u00e7\u00e3o</th><th>Conforme</th></tr></thead><tbody>' + detalheHtml + '</tbody></table>'
    + '<h2>Resumo por exemplar</h2><table><thead><tr><th>Obra</th><th>Concretagem</th><th>Data</th><th>Exemplar</th><th>NF</th><th>Idade ctrl</th><th>Resist. (MPa)</th><th>FCK</th><th>Conforme</th></tr></thead><tbody>' + resumoHtml + '</tbody></table>'
    + '<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>';
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
