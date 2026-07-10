import type { ReactNode } from 'react';
import { Field } from './Field';
import { clampNum, foraDaFaixa } from '../../lib/validacao';

type NumFieldProps = {
  label: string;
  value: unknown;
  onCommit: (n: number | null) => void;
  min?: number;
  max?: number;
  dec?: number;
  soft?: [number, number];
  softMsg?: string;
  hint?: ReactNode;
  disabled?: boolean;
};

// Campo numerico com limite duro (min/max + clamp no blur) e aviso suave (fora da
// faixa usual). O clamp corrige o valor absurdo ao sair do campo; o aviso nao bloqueia.
export function NumField({ label, value, onCommit, min = 0, max = 999999, dec = 0, soft, softMsg, hint, disabled }: NumFieldProps) {
  const step = dec > 0 ? String(1 / 10 ** dec) : '1';
  const error = soft && foraDaFaixa(value, soft[0], soft[1]) ? (softMsg ?? `Fora da faixa usual (${soft[0]}-${soft[1]})`) : undefined;
  return (
    <Field
      label={label}
      type="number"
      inputMode={dec > 0 ? 'decimal' : 'numeric'}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      hint={hint}
      error={error}
      value={value == null ? '' : String(value)}
      onChange={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))}
      onBlur={(e) => onCommit(clampNum(e.target.value, { min, max, dec }))}
    />
  );
}
