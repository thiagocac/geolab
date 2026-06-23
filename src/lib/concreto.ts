// Domínio do concreto reaproveitado do GEOMAT e adaptado ao GEOLAB.
// O padrão de moldagem aceita o formato rico do GEOMAT e o formato legado do GEOLAB.

export type UnidadeIdade = 'dias' | 'horas';
export type TipoEnsaioPadrao = 'compressao' | 'elasticidade' | 'tracao_flexao';

export type PadraoMoldagem = {
  id: string;
  idadeControle: number | string;
  unidadeIdade: UnidadeIdade;
  tipoEnsaio: TipoEnsaioPadrao;
  valorEsperado: number | string;
  crescimentoPct: number | string;
  quantidadeCp: number | string;
};

export const TIPO_ENSAIO_OPCOES: ReadonlyArray<{ value: TipoEnsaioPadrao; label: string }> = [
  { value: 'compressao', label: 'Compressão' },
  { value: 'elasticidade', label: 'Módulo de elasticidade' },
  { value: 'tracao_flexao', label: 'Tração na flexão' },
];

export const UNIDADE_IDADE_OPCOES: ReadonlyArray<{ value: UnidadeIdade; label: string }> = [
  { value: 'dias', label: 'Dias' },
  { value: 'horas', label: 'Horas' },
];

export const FCKS_PADRAO: readonly number[] = [15, 20, 25, 30, 35, 40, 45, 50];

export type PadraoMoldagemShortcut = {
  label: string;
  idadeControle: number;
  unidadeIdade: UnidadeIdade;
  mode: 'percent' | 'value' | 'empty';
  crescimentoPct?: number;
  valorMpa?: number;
};

export const PADRAO_MOLDAGEM_SHORTCUTS: readonly PadraoMoldagemShortcut[] = [
  { label: '+ Vazio', idadeControle: 0, unidadeIdade: 'dias', mode: 'empty' },
  { label: '12 horas', idadeControle: 12, unidadeIdade: 'horas', mode: 'value', valorMpa: 3 },
  { label: '14 horas', idadeControle: 14, unidadeIdade: 'horas', mode: 'value', valorMpa: 3 },
  { label: '60 horas', idadeControle: 60, unidadeIdade: 'horas', mode: 'percent', crescimentoPct: 60 },
  { label: '3 dias', idadeControle: 3, unidadeIdade: 'dias', mode: 'percent', crescimentoPct: 50 },
  { label: '7 dias', idadeControle: 7, unidadeIdade: 'dias', mode: 'percent', crescimentoPct: 70 },
  { label: '14 dias', idadeControle: 14, unidadeIdade: 'dias', mode: 'percent', crescimentoPct: 85 },
  { label: '28 dias', idadeControle: 28, unidadeIdade: 'dias', mode: 'percent', crescimentoPct: 100 },
  { label: '63 dias', idadeControle: 63, unidadeIdade: 'dias', mode: 'percent', crescimentoPct: 100 },
];

let seq = 0;
export function moldUid(prefix = 'pm'): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  } catch { /* fallback */ }
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function padraoMoldagemAgeInHours(pm: Pick<PadraoMoldagem, 'idadeControle' | 'unidadeIdade'>): number {
  const n = toNumber(pm.idadeControle);
  if (n === null) return Number.POSITIVE_INFINITY;
  return pm.unidadeIdade === 'horas' ? n : n * 24;
}

export function linhaDeAtalho(sc: PadraoMoldagemShortcut, fck?: number | null): PadraoMoldagem {
  const base: PadraoMoldagem = {
    id: moldUid(),
    idadeControle: sc.mode === 'empty' ? '' : sc.idadeControle,
    unidadeIdade: sc.unidadeIdade,
    tipoEnsaio: 'compressao',
    valorEsperado: '',
    crescimentoPct: '',
    quantidadeCp: 2,
  };
  if (sc.mode === 'percent' && sc.crescimentoPct != null) {
    base.crescimentoPct = sc.crescimentoPct;
    base.valorEsperado = fck != null ? Math.round((fck * sc.crescimentoPct) / 100 * 10) / 10 : '';
  } else if (sc.mode === 'value' && sc.valorMpa != null) {
    base.valorEsperado = sc.valorMpa;
    base.crescimentoPct = fck != null && fck > 0 ? Math.round((sc.valorMpa / fck) * 100) : '';
  }
  return base;
}

export function padroesMoldagemPadrao(fck?: number | null): PadraoMoldagem[] {
  const v = fck ?? '';
  return [
    { id: moldUid(), idadeControle: 28, unidadeIdade: 'dias', tipoEnsaio: 'compressao', valorEsperado: v, crescimentoPct: 100, quantidadeCp: 2 },
    { id: moldUid(), idadeControle: 63, unidadeIdade: 'dias', tipoEnsaio: 'compressao', valorEsperado: v, crescimentoPct: 100, quantidadeCp: 2 },
  ];
}

export type TracoPadrao = { descricao: string; aplicacao: string; fck: number; slumpPrevisto: number; slumpTolerancia: number; validadeMinutos: number; brita?: string };
export const TRACOS_PADRAO: readonly TracoPadrao[] = [
  { descricao: 'FCK 25 | BRITA 1 | SLUMP 10±2 CM', aplicacao: 'Radier, Térreo, Pavimentos', fck: 25, slumpPrevisto: 10, slumpTolerancia: 2, validadeMinutos: 150, brita: '1' },
  { descricao: 'FCK 30 | BRITA 1 | SLUMP 10±2 CM', aplicacao: 'Sapata, Cortina, Blocos', fck: 30, slumpPrevisto: 10, slumpTolerancia: 2, validadeMinutos: 150, brita: '1' },
  { descricao: 'FCK 30 | BRITA 0 | SLUMP 22±3 CM', aplicacao: 'Estaca Hélice', fck: 30, slumpPrevisto: 22, slumpTolerancia: 3, validadeMinutos: 120, brita: '0' },
  { descricao: 'FCK 40 | BRITA 0 | SLUMP 16±3 CM', aplicacao: 'Contenções', fck: 40, slumpPrevisto: 16, slumpTolerancia: 3, validadeMinutos: 120, brita: '0' },
  { descricao: 'FCK 25 | BRITA 0 | FLOW 70±5 CM', aplicacao: 'Parede/Laje', fck: 25, slumpPrevisto: 70, slumpTolerancia: 5, validadeMinutos: 150, brita: '0' },
];

export function parseSlumpFromDescricao(descricao: string): { previsto: number; tolerancia: number } | null {
  const m = /(?:SLUMP|FLOW)\s*(\d+(?:[.,]\d+)?)\s*(?:±|\+\/-|\+-)\s*(\d+(?:[.,]\d+)?)/i.exec(descricao || '');
  if (!m) return null;
  return { previsto: Number(m[1].replace(',', '.')), tolerancia: Number(m[2].replace(',', '.')) };
}

function normalizeUnidade(raw: unknown): UnidadeIdade {
  const s = String(raw ?? '').toLowerCase();
  return s.startsWith('hora') || s === 'h' ? 'horas' : 'dias';
}

export function normalizePadroes(value: unknown, fck?: number | null): PadraoMoldagem[] {
  if (!Array.isArray(value) || !value.length) return padroesMoldagemPadrao(fck);
  return value
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => {
      const idadeControle = (r.idadeControle ?? r.idade ?? '') as number | string;
      const unidadeIdade = normalizeUnidade(r.unidadeIdade ?? r.unidade);
      const quantidade = (r.quantidadeCp ?? r.quantidade ?? 2) as number | string;
      const valorEsperado = (r.valorEsperado ?? r.valor_esperado ?? (fck ?? '')) as number | string;
      const crescimentoPct = (r.crescimentoPct ?? r.crescimento_pct ?? '') as number | string;
      const tipoRaw = String(r.tipoEnsaio ?? r.tipo_ensaio ?? 'compressao');
      const tipoEnsaio = (['compressao', 'elasticidade', 'tracao_flexao'].includes(tipoRaw) ? tipoRaw : 'compressao') as TipoEnsaioPadrao;
      return { id: typeof r.id === 'string' ? r.id : moldUid(), idadeControle, unidadeIdade, tipoEnsaio, valorEsperado, crescimentoPct, quantidadeCp: quantidade };
    });
}

export function padroesToDb(value: PadraoMoldagem[]): Record<string, unknown>[] {
  return value
    .map((r) => {
      const idade = toNumber(r.idadeControle);
      const qtd = toNumber(r.quantidadeCp);
      return {
        id: r.id || moldUid(),
        idadeControle: r.idadeControle,
        unidadeIdade: r.unidadeIdade,
        tipoEnsaio: r.tipoEnsaio,
        valorEsperado: r.valorEsperado,
        crescimentoPct: r.crescimentoPct,
        quantidadeCp: r.quantidadeCp,
        // Compatibilidade com o fluxo GEOLAB v22 de criação de CPs.
        idade: idade ?? 0,
        unidade: r.unidadeIdade === 'horas' ? 'hora' : 'dia',
        quantidade: qtd ?? 0,
      };
    })
    .filter((r) => Number(r.idade) > 0 && Number(r.quantidade) > 0);
}

export function codigoTracoFromDescricao(descricao: string): string {
  const clean = descricao.trim().toUpperCase().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 80) : 'TRAÇO CONCRETO';
}
