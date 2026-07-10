import { Badge } from './Badge';
import { recordStatusMeta, type StatusDomain } from '../../lib/status';

// domain: overrides contextuais de label/tom (ex.: concretagem — registrado→Confirmada). Ver lib/status.ts.
export function StatusBadge({ status, domain }: { status?: string | null; domain?: StatusDomain }) {
  const { label, tone } = recordStatusMeta(status, domain);
  return <Badge tone={tone}>{label}</Badge>;
}
