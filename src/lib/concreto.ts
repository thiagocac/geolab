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

// Curva de resistencia esperada por idade — FONTE UNICA (o cliente nao lanca mais valor esperado/cresc.).
// Ancoras: 12h/14h = 3 MPa fixos; 3d=50%, 7d=70%, 14d=85%, 28d=100%, 63d=100% do FCK previsto.
// Qualquer outra idade (inclusive outra idade de controle) = interpolacao linear em MPa pela idade-em-horas.
const CURVA_ESPERADO: ReadonlyArray<{ h: number; mpa: (fck: number) => number }> = [
  { h: 12, mpa: () => 3 },
  { h: 14, mpa: () => 3 },
  { h: 72, mpa: (f) => f * 0.5 },
  { h: 168, mpa: (f) => f * 0.7 },
  { h: 336, mpa: (f) => f * 0.85 },
  { h: 672, mpa: (f) => f },
  { h: 1512, mpa: (f) => f },
];
const round1 = (n: number): number => Math.round(n * 10) / 10;

export function esperadoMpaPorIdade(idadeControle: number | string, unidadeIdade: UnidadeIdade, fck?: number | null): number | null {
  const f = toNumber(fck);
  if (f === null || f <= 0) return null;
  const h = padraoMoldagemAgeInHours({ idadeControle, unidadeIdade });
  if (!Number.isFinite(h) || h <= 0) return null;
  const pts = CURVA_ESPERADO.map((p) => ({ h: p.h, v: p.mpa(f) }));
  if (h <= pts[0].h) return round1(pts[0].v);
  if (h >= pts[pts.length - 1].h) return round1(pts[pts.length - 1].v);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (h >= a.h && h <= b.h) { const frac = (h - a.h) / (b.h - a.h); return round1(a.v + frac * (b.v - a.v)); }
  }
  return round1(f);
}

export function crescimentoPctPorIdade(idadeControle: number | string, unidadeIdade: UnidadeIdade, fck?: number | null): number | null {
  const f = toNumber(fck);
  const esp = esperadoMpaPorIdade(idadeControle, unidadeIdade, fck);
  if (f === null || f <= 0 || esp === null) return null;
  return Math.round((esp / f) * 100);
}

export function linhaDeAtalho(sc: PadraoMoldagemShortcut, fck?: number | null): PadraoMoldagem {
  const vazio = sc.mode === 'empty';
  return {
    id: moldUid(),
    idadeControle: vazio ? '' : sc.idadeControle,
    unidadeIdade: sc.unidadeIdade,
    tipoEnsaio: 'compressao',
    valorEsperado: vazio ? '' : (esperadoMpaPorIdade(sc.idadeControle, sc.unidadeIdade, fck) ?? ''),
    crescimentoPct: vazio ? '' : (crescimentoPctPorIdade(sc.idadeControle, sc.unidadeIdade, fck) ?? ''),
    quantidadeCp: 2,
  };
}

export function padroesMoldagemPadrao(fck?: number | null): PadraoMoldagem[] {
  const mk = (idade: number): PadraoMoldagem => ({ id: moldUid(), idadeControle: idade, unidadeIdade: 'dias', tipoEnsaio: 'compressao', valorEsperado: esperadoMpaPorIdade(idade, 'dias', fck) ?? '', crescimentoPct: crescimentoPctPorIdade(idade, 'dias', fck) ?? '', quantidadeCp: 2 });
  return [mk(28), mk(63)];
}

export type TracoPadrao = { descricao: string; aplicacao: string; fck: number; slumpPrevisto: number; slumpTolerancia: number; validadeMinutos: number; brita?: string };
export const TRACOS_PADRAO: readonly TracoPadrao[] = [
  { descricao: 'FCK 25 | BRITA 1 | SLUMP 100±20 MM', aplicacao: 'Radier, Térreo, Pavimentos', fck: 25, slumpPrevisto: 100, slumpTolerancia: 20, validadeMinutos: 150, brita: '1' },
  { descricao: 'FCK 30 | BRITA 1 | SLUMP 100±20 MM', aplicacao: 'Sapata, Cortina, Blocos', fck: 30, slumpPrevisto: 100, slumpTolerancia: 20, validadeMinutos: 150, brita: '1' },
  { descricao: 'FCK 30 | BRITA 0 | SLUMP 220±30 MM', aplicacao: 'Estaca Hélice', fck: 30, slumpPrevisto: 220, slumpTolerancia: 30, validadeMinutos: 120, brita: '0' },
  { descricao: 'FCK 40 | BRITA 0 | SLUMP 160±30 MM', aplicacao: 'Contenções', fck: 40, slumpPrevisto: 160, slumpTolerancia: 30, validadeMinutos: 120, brita: '0' },
  { descricao: 'FCK 25 | BRITA 0 | FLOW 700±50 MM', aplicacao: 'Parede/Laje', fck: 25, slumpPrevisto: 700, slumpTolerancia: 50, validadeMinutos: 150, brita: '0' },
];

export function parseSlumpFromDescricao(descricao: string): { previsto: number; tolerancia: number } | null {
  const m = /(?:SLUMP|FLOW)\s*(\d+(?:[.,]\d+)?)\s*(?:±|\+\/-|\+-)\s*(\d+(?:[.,]\d+)?)\s*(MM|CM)?/i.exec(descricao || '');
  if (!m) return null;
  // Canonico = mm. Sem unidade ou 'CM' interpreta como cm (converte x10); 'MM' ja em mm.
  const fator = (m[3] || '').toUpperCase() === 'MM' ? 1 : 10;
  return { previsto: Number(m[1].replace(',', '.')) * fator, tolerancia: Number(m[2].replace(',', '.')) * fator };
}

function normalizeUnidade(raw: unknown): UnidadeIdade {
  const s = String(raw ?? '').toLowerCase();
  return s.startsWith('hora') || s === 'h' ? 'horas' : 'dias';
}

export function normalizePadroes(value: unknown, fck?: number | null): PadraoMoldagem[] {
  const arr = (!Array.isArray(value) || !value.length)
    ? padroesMoldagemPadrao(fck)
    : value
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
        .map((r) => {
          const idadeControle = (r.idadeControle ?? r.idade ?? '') as number | string;
          const unidadeIdade = normalizeUnidade(r.unidadeIdade ?? r.unidade);
          const quantidade = (r.quantidadeCp ?? r.quantidade ?? 2) as number | string;
          const tipoRaw = String(r.tipoEnsaio ?? r.tipo_ensaio ?? 'compressao');
          const tipoEnsaio = (['compressao', 'elasticidade', 'tracao_flexao'].includes(tipoRaw) ? tipoRaw : 'compressao') as TipoEnsaioPadrao;
          // valorEsperado/crescimentoPct SEMPRE derivados do FCK+idade (cliente nao lanca mais).
          const valorEsperado = esperadoMpaPorIdade(idadeControle, unidadeIdade, fck) ?? '';
          const crescimentoPct = crescimentoPctPorIdade(idadeControle, unidadeIdade, fck) ?? '';
          return { id: typeof r.id === 'string' ? r.id : moldUid(), idadeControle, unidadeIdade, tipoEnsaio, valorEsperado, crescimentoPct, quantidadeCp: quantidade };
        });
  // Sempre ordenado da menor idade para a maior (12h vem antes de 28d).
  return [...arr].sort((a, b) => padraoMoldagemAgeInHours(a) - padraoMoldagemAgeInHours(b));
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

// Numeração sequencial de CP do laboratório (v132). Incrementa o ÚLTIMO grupo de dígitos da
// numeração-base preservando prefixo/sufixo e o zero-padding. BigInt p/ números longos.
// Ex.: bumpNumeracao('1235689', 1) => '1235690'; ('A-099', 1) => 'A-100'; ('0001', 12) => '0013'.
export function bumpNumeracao(base: string, step: number): string {
  const s = String(base ?? '').trim();
  if (!s) return '';
  const m = /^(.*?)(\d+)(\D*)$/.exec(s);
  if (!m) return s;
  const [, prefix, digits, suffix] = m;
  const next = BigInt(digits) + BigInt(Math.trunc(step));
  const txt = next < 0n ? '0' : next.toString();
  const padded = txt.length < digits.length ? txt.padStart(digits.length, '0') : txt;
  return prefix + padded + suffix;
}

export function codigoTracoFromDescricao(descricao: string): string {
  const clean = descricao.trim().toUpperCase().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 80) : 'TRAÇO CONCRETO';
}
