import type { ReactElement } from 'react';
import { Tooltip as BuiTooltip } from '@base-ui/react/tooltip';

export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <BuiTooltip.Root>
      <BuiTooltip.Trigger render={children} />
      <BuiTooltip.Portal>
        <BuiTooltip.Positioner sideOffset={6} className="bui-tooltip-pos">
          <BuiTooltip.Popup className="bui-tooltip">{label}</BuiTooltip.Popup>
        </BuiTooltip.Positioner>
      </BuiTooltip.Portal>
    </BuiTooltip.Root>
  );
}
