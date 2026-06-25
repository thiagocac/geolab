// Helpers puros do portal (sem dependencia de Supabase): filtros, consolidacao por
// exemplar e exportador Excel. Reusados pelo portal autenticado e pelo publico.
import type { ExemplarResumo, LaudoFiltro, ParcialFinal, PortalLaudoView, PortalResultadoRow, ResultadoFiltro } from './types';

const norm = (v: unknown) => String(v ?? '').toLowerCase();

export function parcialFinalMeta(value: ParcialFinal): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (value === 'final') return { label: 'Final', tone: 'success' };
  if (value === 'parcial') return { label: 'Parcial', tone: 'warning' };
  return { label: 'Sem resultados', tone: 'neutral' };
}

export function filtraLaudos(laudos: PortalLaudoView[], f: LaudoFiltro): PortalLaudoView[] {
  const t = f.texto.trim().toLowerCase();
  return laudos.filter((l) => {
    if (f.workId && l.work_id !== f.workId) return false;
    if (f.tipo !== 'todos' && l.parcial_final !== f.tipo) return false;
    if (f.status && l.status !== f.status) return false;
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

const conformeTxt = (v: boolean | null) => (v == null ? '' : v ? 'Conforme' : 'Nao conforme');

// Exporta a planilha respeitando o filtro atual (recebe as linhas ja filtradas).
export async function exportResultadosXlsx(rows: PortalResultadoRow[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const detalhe = rows.map((r) => ({
    Obra: r.work_nome ?? '',
    Concretagem: r.concretagem_codigo ?? '',
    Data: r.data_concretagem ?? '',
    Fornecedor: r.fornecedor_texto ?? '',
    'Local/Peca': r.local_texto ?? '',
    NF: r.nota_fiscal ?? '',
    Exemplar: r.amostra_codigo ?? '',
    CP: r.cp_codigo ?? r.numeracao_lab ?? '',
    'Idade (dias)': r.idade_dias ?? '',
    'Data rompimento': r.data_rompimento ?? '',
    'Carga (kN)': r.carga_ruptura_kn ?? '',
    'Resultado (MPa)': r.resultado_valor ?? '',
    'FCK (MPa)': r.fck_ref ?? '',
    'Idade controle (dias)': r.idade_controle ?? '',
    'Idade de controle?': r.is_controle ? 'Sim' : 'Nao',
    Conforme: conformeTxt(r.conforme),
    Situacao: r.situacao ?? '',
  }));
  const resumo = consolidarExemplares(rows).map((e) => ({
    Obra: e.work_nome ?? '',
    Concretagem: e.concretagem_codigo ?? '',
    Data: e.data ?? '',
    Exemplar: e.exemplar ?? '',
    NF: e.nf ?? '',
    'Idade controle (dias)': e.idade_controle ?? '',
    'Resistencia (MPa)': e.resistencia ?? '',
    'FCK (MPa)': e.fck ?? '',
    Conforme: conformeTxt(e.conforme),
    'Nro CPs': e.n_cps,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo por exemplar');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), 'Detalhe por CP');
  XLSX.writeFile(wb, filename);
}
