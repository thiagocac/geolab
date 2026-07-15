import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/State';
import { Copy, Pencil, XCircle, Plus } from '../../components/ui/icons';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { EstruturaEditor } from '../../components/domain/EstruturaEditor';
import { listPortalEstruturas, savePortalEstrutura, duplicatePortalEstrutura, deletePortalEstrutura } from '../../lib/api/portalEstrutura';
import type { Estrutura, EstruturaPeca } from '../../lib/api/estruturaObra';

export function PortalEstruturaTab({ works }: { works: { id: string; nome: string }[] }) {
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [work, setWork] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [pecas, setPecas] = useState<EstruturaPeca[]>([]);
  const [busy, setBusy] = useState(false);
  const estruturas = useQuery({ queryKey: ['portal-estruturas', work], queryFn: () => listPortalEstruturas(work), enabled: !!work });

  function novo() { setEditId(null); setNome(''); setPecas([]); setOpen(true); }
  function editar(e: Estrutura) { setEditId(e.id); setNome(e.nome); setPecas(e.pecas.map((p) => ({ ...p }))); setOpen(true); }
  async function salvar() {
    if (!work) return;
    setBusy(true);
    try { await savePortalEstrutura(work, { id: editId ?? undefined, nome, pecas }); await qc.invalidateQueries({ queryKey: ['portal-estruturas', work] }); toast(editId ? 'Estrutura atualizada.' : 'Estrutura criada.', 'success'); setOpen(false); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function duplicar(e: Estrutura) { try { await duplicatePortalEstrutura(e.id); await qc.invalidateQueries({ queryKey: ['portal-estruturas', work] }); toast('Estrutura duplicada.', 'success'); } catch (err) { toast((err as Error).message, 'error'); } }
  async function remover(e: Estrutura) { if (!(await confirm({ title: 'Remover estrutura', message: 'Remover "' + e.nome + '" e suas peças?', danger: true, confirmLabel: 'Remover' }))) return; try { await deletePortalEstrutura(e.id); await qc.invalidateQueries({ queryKey: ['portal-estruturas', work] }); toast('Estrutura removida.', 'success'); } catch (err) { toast((err as Error).message, 'error'); } }

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Obra</span>
            <select className="input" value={work} onChange={(e) => setWork(e.target.value)} aria-label="Obra"><option value="">Selecione a obra…</option>{works.map((w) => <option key={w.id} value={w.id}>{w.nome}</option>)}</select>
          </div>
          {work ? <Button onClick={novo}><Plus size={16} /> Nova estrutura</Button> : null}
        </div>
        {!work ? <p className="text-sm text-slate-500">Selecione a obra para cadastrar suas estruturas (Bloco/Torre/Anexo) e peças.</p> : estruturas.isLoading ? <LoadingState /> : (estruturas.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700">Nenhuma estrutura cadastrada. Enquanto não cadastrar, o local/peça continua texto livre na Programação. Clique em <b>Nova estrutura</b>.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(estruturas.data ?? []).map((e) => (
              <div key={e.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-black text-slate-950 dark:text-slate-50">{e.nome}</h3>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={() => editar(e)} aria-label="Editar estrutura"><Pencil size={15} /></button>
                    <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={() => void duplicar(e)} aria-label="Duplicar estrutura"><Copy size={15} /></button>
                    <button type="button" className="icon-btn !min-h-8 !min-w-8 hover:!text-red-600" onClick={() => void remover(e)} aria-label="Remover estrutura"><XCircle size={15} /></button>
                  </div>
                </div>
                {e.pecas.length ? <div className="flex flex-wrap gap-1.5">{e.pecas.map((p) => <span key={p.id} className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">{p.nome}</span>)}</div> : <p className="text-xs text-slate-500">Sem peças.</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={open} wide title={editId ? 'Editar estrutura' : 'Nova estrutura'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} busy={busy} disabled={!nome.trim()}>{busy ? 'Salvando…' : 'Salvar estrutura'}</Button></>}>
        <EstruturaEditor nome={nome} pecas={pecas} onNome={setNome} onPecas={setPecas} />
      </Modal>
    </Card>
  );
}
