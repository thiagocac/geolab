import { useState } from 'react';
import { Field, TextArea } from '../ui/Field';
import { Button } from '../ui/Button';
import { ArrowUp, ArrowDown, XCircle } from '../ui/icons';
import { novoId, type EstruturaPeca } from '../../lib/api/estruturaObra';

export function EstruturaEditor({ nome, pecas, onNome, onPecas }: { nome: string; pecas: EstruturaPeca[]; onNome: (v: string) => void; onPecas: (p: EstruturaPeca[]) => void }) {
  const [bulk, setBulk] = useState('');
  function set(i: number, v: string) { const n = pecas.slice(); n[i] = { ...n[i], nome: v }; onPecas(n); }
  function rm(i: number) { onPecas(pecas.filter((_, j) => j !== i)); }
  function move(i: number, d: number) { const j = i + d; if (j < 0 || j >= pecas.length) return; const n = pecas.slice(); const tmp = n[i]; n[i] = n[j]; n[j] = tmp; onPecas(n); }
  function add() { onPecas([...pecas, { id: novoId(), nome: '' }]); }
  function addBulk() { const linhas = bulk.split('\n').map((s) => s.trim()).filter(Boolean).map((n) => ({ id: novoId(), nome: n })); if (linhas.length) { onPecas([...pecas, ...linhas]); setBulk(''); } }
  return (
    <div className="space-y-4">
      <Field label="Nome da estrutura (ex.: Bloco 1, Torre 3, Anexo, Contenções)" required value={nome} onChange={(e) => onNome(e.target.value)} />
      <div>
        <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Peças ({pecas.length})</span><Button variant="secondary" onClick={add}>Adicionar peça</Button></div>
        {pecas.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-500 dark:border-slate-700">Nenhuma peça ainda. Adicione uma a uma ou cole várias abaixo (uma por linha).</p> : (
          <div className="space-y-2">
            {pecas.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                <input className="input !min-h-9 w-full px-2 py-1" value={p.nome} onChange={(e) => set(i, e.target.value)} aria-label={'Peça ' + (i + 1)} placeholder="Ex.: Estacas, Radier, 1º Pavimento" />
                <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown size={14} /></button>
                <button type="button" className="icon-btn !min-h-8 !min-w-8 hover:!text-red-600" onClick={() => rm(i)} aria-label="Remover peça"><XCircle size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <TextArea label="Colar várias peças (uma por linha)" value={bulk} onChange={(e) => setBulk(e.target.value)} rows={3} />
        <div className="mt-2"><Button variant="secondary" onClick={addBulk} disabled={!bulk.trim()}>Adicionar da lista</Button></div>
      </div>
    </div>
  );
}
