// Utilitarios de validacao de campos numericos (anti-valores-absurdos).
// Camada 1 (formato) + camada 2 (limites). Ref.: GEOLAB-Auditoria-Validacao-Campos-v1.md.

// Formato: troca virgula por ponto, remove nao-numerico e limita casas decimais.
export const sanitizeDecimal = (raw: string, maxDec = 2): string => {
  let v = String(raw ?? '').replace(',', '.').replace(/[^0-9.]/g, '');
  const i = v.indexOf('.');
  if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, maxDec);
  return v;
};

// Formato: so digitos; opcionalmente remove zeros a esquerda (mantendo um "0" isolado).
export const sanitizeDigits = (raw: string, stripLeadingZeros = false): string => {
  let v = String(raw ?? '').replace(/\D/g, '');
  if (stripLeadingZeros) v = v.replace(/^0+(?=\d)/, '');
  return v;
};

export const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

// Limite (para onBlur): parseia, limita a faixa [min,max] e arredonda p/ `dec` casas.
// Retorna number|null (null quando vazio/invalido).
export const clampNum = (raw: unknown, opts: { min: number; max: number; dec?: number }): number | null => {
  const { min, max, dec = 0 } = opts;
  const s = String(raw ?? '').replace(',', '.').trim();
  if (s === '') return null;
  const parsed = Number(s);
  if (!Number.isFinite(parsed)) return null;
  const clamped = clamp(parsed, min, max);
  const f = 10 ** dec;
  return Math.round(clamped * f) / f;
};

// Aviso suave (nao bloqueia): true quando o valor preenchido esta fora da faixa usual.
export const foraDaFaixa = (raw: unknown, lo: number, hi: number): boolean => {
  const s = String(raw ?? '').replace(',', '.').trim();
  if (s === '') return false;
  const n = Number(s);
  return Number.isFinite(n) && (n < lo || n > hi);
};
