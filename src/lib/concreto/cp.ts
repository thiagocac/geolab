export type UnidadeCarga = 'kn' | 'tf' | 'kgf';
export type DimensaoCP = { diametroMm: number; alturaMm: number };

export const DIMENSOES_CP: readonly { label: string; diametroMm: number; alturaMm: number }[] = [
  { label: '10 x 20 cm', diametroMm: 100, alturaMm: 200 },
  { label: '15 x 30 cm', diametroMm: 150, alturaMm: 300 },
  { label: '5 x 10 cm', diametroMm: 50, alturaMm: 100 },
];

export function fatorHD(d: number, h: number): number {
  const r = d > 0 ? h / d : 2;
  if (r >= 2.0) return 1.0;
  if (r >= 1.75) return 0.98 + ((r - 1.75) / 0.25) * 0.02;
  if (r >= 1.5) return 0.97 + ((r - 1.5) / 0.25) * 0.01;
  if (r >= 1.25) return 0.94 + ((r - 1.25) / 0.25) * 0.03;
  if (r >= 1.0) return 0.87 + ((r - 1.0) / 0.25) * 0.07;
  return 0.87;
}

export function cargaParaKn(carga: number, unidade: UnidadeCarga): number {
  if (!Number.isFinite(carga) || carga <= 0) return 0;
  if (unidade === 'tf') return carga * 9.80665;
  if (unidade === 'kgf') return carga * 0.00980665;
  return carga;
}

export function cargaParaMpa(carga: number, unidade: UnidadeCarga, d: number, h: number): number {
  const kn = cargaParaKn(carga, unidade);
  const area = Math.PI * (d / 2) * (d / 2);
  if (!area || !kn) return 0;
  const mpa = ((kn * 1000) / area) * fatorHD(d, h);
  return Math.round(mpa * 10) / 10;
}

export function relacaoHD(d: number, h: number): number | null {
  if (!d || !h) return null;
  return Math.round((h / d) * 100) / 100;
}
