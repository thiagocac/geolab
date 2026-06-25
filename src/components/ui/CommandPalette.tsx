import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';

export type Command = { id: string; label: string; group?: string; keywords?: string; run: () => void };

export function CommandPalette({ commands, open, onOpenChange }: { commands: Command[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onOpenChange(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOpenChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.label + ' ' + (c.group ?? '') + ' ' + (c.keywords ?? '')).toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { if (open) { const t = setTimeout(() => inputRef.current?.focus(), 10); return () => clearTimeout(t); } }, [open]);
  useEffect(() => { listRef.current?.querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  function exec(c?: Command) { const cmd = c ?? filtered[active]; if (!cmd) return; onOpenChange(false); setQuery(''); cmd.run(); }
  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQuery(''); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="bui-backdrop" />
        <Dialog.Popup className="cmdk-popup" onKeyDown={onKeyDown}>
          <input ref={inputRef} className="cmdk-input" placeholder="Buscar telas e ações..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
          <div className="cmdk-list" ref={listRef}>
            {filtered.length === 0 ? <div className="cmdk-empty">Nada encontrado.</div> : filtered.map((c, i) => (
              <button type="button" key={c.id} className={'cmdk-item' + (i === active ? ' active' : '')} onMouseMove={() => setActive(i)} onClick={() => exec(c)}>
                <span>{c.label}</span>{c.group ? <span className="cmdk-group">{c.group}</span> : null}
              </button>
            ))}
          </div>
          <div className="cmdk-foot"><kbd>↑↓</kbd> navegar · <kbd>enter</kbd> abrir · <kbd>esc</kbd> fechar</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
