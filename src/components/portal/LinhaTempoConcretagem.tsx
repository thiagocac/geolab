import type { PortalLaudoView, PortalResultadoRow } from '../../lib/portal/types';

// B2 - Linha do tempo da concretagem: Programada -> Concretada -> Moldada -> Rompida -> Laudo.
export function LinhaTempoConcretagem({ laudo, cps }: { laudo: PortalLaudoView; cps: PortalResultadoRow[] }) {
  const dataConc = cps.find((c) => c.data_concretagem)?.data_concretagem ?? null;
  const temCps = cps.length > 0;
  const temResultado = cps.some((c) => c.resultado_valor != null);
  const datasRomp = cps.map((c) => c.data_rompimento).filter((d): d is string => !!d).sort();
  const dataRompimento = datasRomp.length ? datasRomp[datasRomp.length - 1] : null;
  const emitido = laudo.status === 'emitido';
  const etapas: { label: string; ok: boolean; data: string | null }[] = [
    { label: 'Programada', ok: true, data: null },
    { label: 'Concretada', ok: !!dataConc, data: dataConc },
    { label: 'Moldada', ok: temCps, data: null },
    { label: 'Rompida', ok: temResultado, data: dataRompimento },
    { label: 'Laudo', ok: emitido, data: laudo.data_emissao },
  ];
  return (
    <div className="flex flex-wrap items-start gap-1 px-3 py-3">
      {etapas.map((e, i) => (
        <div key={e.label} className="flex items-start gap-1">
          <div className="flex w-16 flex-col items-center text-center">
            <span className={'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ' + (e.ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-slate-700')}>{e.ok ? '✓' : i + 1}</span>
            <span className={'mt-1 text-[11px] ' + (e.ok ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400')}>{e.label}</span>
            {e.data ? <span className="text-[10px] text-slate-400">{e.data.slice(5)}</span> : null}
          </div>
          {i < etapas.length - 1 ? <span className={'mt-2 h-0.5 w-6 ' + (etapas[i + 1].ok ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700')} /> : null}
        </div>
      ))}
    </div>
  );
}
