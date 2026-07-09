import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/State';
import { Copy, Pencil, XCircle, Plus } from '../../components/ui/icons';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { EstruturaEditor } from '../../components/domain/EstruturaEditor';
import { listObras, listEstruturas, salvarEstrutura, duplicarEstrutura, removerEstrutura, type Estrutura, type EstruturaPeca } from '../../lib/api/estruturaObra';

export function EstruturaPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [work, setWork] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [pecas, setPecas] = useState<EstruturaPeca[]>([]);
  const [busy, setBusy] = useState(false);

  const obras = useQuery({ queryKey: ['obras-todas'], queryFn: listObras });
  const estruturas = useQuery({ queryKey: ['estruturas', work], queryFn: () => listEstruturas(work), enabled: !!work });

  function novo() { setEditId(null); setNome(''); setPecas([]); setOpen(true); }
  function editar(e: Estrutura) { setEditId(e.id); setNome(e.nome); setPecas(e.pecas.map((p) => ({ ...p }))); setOpen(true); }
  async function salvar() {
    if (!member || !work) return;
    setBusy(true);
    try {
      await salvarEstrutura(member.tenant_id, work, { id: editId ?? undefined, nome, pecas });
      await qc.invalidateQueries({ queryKey: ['estruturas', work] });
      toast(editId ? 'Estrutura atualizada.' : 'Estrutura criada.', 'success');
      setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function duplicar(e: Estrutura) {
    if (!member || !work) return;
    try { await duplicarEstrutura(member.tenant_id, work, e); await qc.invalidateQueries({ queryKey: ['estruturas', work] }); toast('Estrutura duplicada.', 'success'); } catch (err) { toast((err as Error).message, 'error'); }
  }
  async function remover(e: Estrutura) {
    if (!(await confirm({ title: 'Remover estrutura', message: 'Remover "' + e.nome + '" e suas peças? Programações já feitas não são afetadas.', danger: true, confirmLabel: 'Remover' }))) return;
    try { await removerEstrutura(e.id); await qc.invalidateQueries({ queryKey: ['estruturas', work] }); toast('Estrutura removida.', 'success'); } catch (err) { toast((err as Error).message, 'error'); }
  }

  return (
    <section className="space-y-4">
      <PageHeader kicker="Cadastros" title="Estrutura da obra" description="Crie estruturas (Bloco 1, Torre 3, Anexo…) com suas peças (Estacas, Radier, Pavimentos…). Duplique para reaproveitar. Aparecem como Estrutura + Peça na programação." />
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-md"><SelectField label="Obra" value={work} onChange={(e) => setWork(e.target.value)}><option value="">Selecione a obra…</option>{(obras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField></div>
          {work ? <Button onClick={novo}><Plus size={16} /> Nova estrutura</Button> : null}
        </div>
      </Card>

      {!work ? null : estruturas.isLoading ? <LoadingState /> : (estruturas.data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300"><b>Nenhuma estrutura cadastrada.</b><br />Enquanto não houver estrutura, o local/peça da concretagem continua como texto livre. Clique em <b>Nova estrutura</b> para começar.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(estruturas.data ?? []).map((e) => (
            <Card key={e.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-black text-slate-950 dark:text-slate-50">{e.nome}</h3>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={() => editar(e)} aria-label="Editar estrutura"><Pencil size={15} /></button>
                  <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={() => void duplicar(e)} aria-label="Duplicar estrutura"><Copy size={15} /></button>
                  <button type="button" className="icon-btn !min-h-8 !min-w-8 hover:!text-red-600" onClick={() => void remover(e)} aria-label="Remover estrutura"><XCircle size={15} /></button>
                </div>
              </div>
              {e.pecas.length ? (
                <div className="flex flex-wrap gap-1.5">{e.pecas.map((p) => <span key={p.id} className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">{p.nome}</span>)}</div>
              ) : <p className="text-xs text-slate-500">Sem peças.</p>}
              <p className="mt-2 text-[11px] text-slate-400">{e.pecas.length} peça(s)</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} wide title={editId ? 'Editar estrutura' : 'Nova estrutura'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy || !nome.trim()}>{busy ? 'Salvando…' : 'Salvar estrutura'}</Button></>}>
        <EstruturaEditor nome={nome} pecas={pecas} onNome={setNome} onPecas={setPecas} />
      </Modal>
    </section>
  );
}
