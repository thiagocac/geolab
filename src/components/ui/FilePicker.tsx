import { useRef, useState, type InputHTMLAttributes } from 'react';

// T20 (auditoria UX): padrao visual unico para upload — label-botao + input sr-only + nome do
// arquivo escolhido. Mesmo desenho da Importacao Excel; o input nativo cru varia por navegador.
// `resetAfter` limpa o value apos o onFiles (permite reenviar o MESMO arquivo), mantendo o nome.
export function FilePicker({ label = 'Escolher arquivo', hint, onFiles, resetAfter, disabled, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className' | 'onChange'> & { label?: string; hint?: string; resetAfter?: boolean; onFiles: (files: File[]) => void }) {
  const [names, setNames] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <label className={'btn btn-secondary cursor-pointer' + (disabled ? ' pointer-events-none opacity-60' : '')}>
        {label}
        <input ref={ref} type="file" className="sr-only" disabled={disabled} onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) setNames(fs.map((f) => f.name).join(', ')); onFiles(fs); if (resetAfter && ref.current) ref.current.value = ''; }} {...props} />
      </label>
      {names ? <span className="max-w-56 truncate text-xs font-semibold text-slate-500 dark:text-slate-400" title={names}>{names}</span> : hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </span>
  );
}
