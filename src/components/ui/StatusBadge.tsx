import { Badge } from './Badge';
import { recordStatusMeta } from '../../lib/status';

export function StatusBadge({ status }: { status?: string | null }) {
  const { label, tone } = recordStatusMeta(status);
  return <Badge tone={tone}>{label}</Badge>;
}
