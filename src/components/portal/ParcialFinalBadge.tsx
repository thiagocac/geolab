import { Badge } from '../ui/Badge';
import { parcialFinalMeta } from '../../lib/portal/resultados';
import type { ParcialFinal } from '../../lib/portal/types';

export function ParcialFinalBadge({ value }: { value: ParcialFinal }) {
  const m = parcialFinalMeta(value);
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
