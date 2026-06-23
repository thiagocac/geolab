import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { MoldingStandardEditor } from '../../components/domain/MoldingStandardEditor';
import { createConcretagem, listProgramacoes, confirmarProgramacao, cancelarProgramacao, listTracosComFck, invokeFicha } from '../../lib/api/concretagem';
import { listReference } from '../../lib/api/client';
import { listColaboradores } from '../../lib/api/colaboradores';
import { normalizePadroes, padroesMoldagemPadrao, padroesToDb, toNumber, type PadraoMoldagem } from '../../lib/concreto';

const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => toNumber(v as number | string | null | undefined);
const val = (v: unknown) => v == null ? '' : String(v);
function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }
function statusCls(s: string) { if (s === 'registrado' || s === 'aprovado') return 'bg-green-100 text-green-700'; if (s === 'cancelada') return 'bg-red-100 text-red-700'; if (s === 'pendente') return 'bg-amber-100 text-amber-800'; return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'; }

export function ProgramacoesPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({ origem: 'programada', dimensao_cp: '100x200' });
  const [padrao, setPadrao] = useState<PadraoMoldagem[]>(padroesMoldagemPadrao(30));
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['programacoes'], queryFn: listProgramacoes });
  const clientes = useQuery({ queryKey: ['ref', 'lab_clients', 'prog'], queryFn: () => listReference('lab_clients', 'razao_social') });
  const obras = useQuery({ queryKey: ['ref', 'client_works', form.client_id, 'prog'], queryFn: () => listReference('client_works', 'nome', form.client_id ? { client_id: String(form.client_id) } : undefined), enabled: !!form.client_id });
  const tracos = useQuery({ queryKey: ['tracos-fck'], queryFn: listTracosComFck });
  const moldadores = useQuery({ queryKey: ['colaboradores-ref'], queryFn: listColaboradores });

  function patch(k: string, v: unknown) { setForm((s) => ({ ...s, [k]: v })); }
  function novo() { setForm({ origem: 'programada', dimensao_cp: '100x200', status: 'rascunho' }); setPadrao(padroesMoldagemPadrao(30)); setOpen(true); }
  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!form.client_id || !form.work_id) throw new Error('Cliente e obra são obrigatórios.');
      const payload = {
        origem: 'programada', status: 'rascunho', client_id: String(form.client_id), work_id: String(form.work_id),
        operational_material_id: str(form.operational_material_id) || null, traco_texto: str(form.traco_texto) || null,
        fck_previsto: num(form.fck_previsto), fornecedor_texto: str(form.fornecedor_texto) || null,
        data_programada: str(form.data_programada) || null, hora_programada: str(form.hora_programada) || null,
        local_texto: str(form.local_texto) || null, volume_programado_m3: num(form.volume_programado_m3),
        dimensao_cp: str(form.dimensao_cp) || '100x200', moldador_id: str(form.moldador_id) || null,
        observacoes: str(form.observacoes) || null, metadata: { padrao_moldagem: padroesToDb(padrao), origem_ui: 'programacao-lab-v29' },
      };
      const created = await createConcretagem(member.tenant_id, payload);
      await qc.invalidateQueries({ queryKey: ['programacoes'] });
      await qc.invalidateQueries({ queryKey: ['concretagens'] });
      toast('Programação criada.', 'success');
      setOpen(false);
      nav('/concretagens/' + created.id);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function confirmar(id: string) { try { await confirmarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação confirmada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function cancelar(id: string) { try { await cancelarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação cancelada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function ficha(id: string) { try { dl(await invokeFicha(id), 'ficha-programacao.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows = q.data ?? [];
  return (
    <section className="space-y-4">
      <PageHeader kicker="Concreto · laboratório" title="Programação de concretagens" description="Agenda do laboratório para solicitações da obra, portal do cliente e programações internas. A confirmação transforma a programação em atendimento pronto para ficha e caminhões." />
      <div className="flex justify-end"><Button onClick={novo}>Nova programação</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-3 py-2">Status</th><th>Data/hora</th><th>Cliente / obra</th><th>Local / peça</th><th>Traço</th><th>Fornecedor</th><th>Volume</th><th>Ações</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2"><span className={'rounded-full px-2 py-1 text-xs font-black ' + statusCls(r.status)}>{r.status}</span><div className="mt-1 text-[11px] text-slate-400">{r.origem}</div></td>
                    <td className="px-3 py-2 font-bold">{r.data_programada ?? r.data_real ?? '-'}<div className="text-xs font-normal text-slate-500">{r.hora_programada ?? r.hora_inicio ?? '-'}</div></td>
                    <td className="px-3 py-2"><b>{r.lab_clients?.razao_social ?? '-'}</b><div className="text-xs text-slate-500">{r.client_works?.nome ?? '-'}</div></td>
                    <td className="px-3 py-2">{r.local_texto ?? '-'}</td>
                    <td className="px-3 py-2">{r.operational_materials?.nome ?? r.traco_texto ?? '-'}<div className="text-xs text-slate-500">FCK {r.fck_previsto ?? r.operational_materials?.fck_mpa ?? '-'} MPa</div></td>
                    <td className="px-3 py-2">{r.fornecedor_texto ?? '-'}</td>
                    <td className="px-3 py-2">{r.volume_programado_m3 ?? '-'} m³</td>
                    <td className="px-3 py-2"><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => nav('/concretagens/' + r.id)}>Abrir</Button>{r.status !== 'registrado' && r.status !== 'cancelada' ? <Button variant="secondary" onClick={() => void confirmar(r.id)}>Confirmar</Button> : null}<Button variant="ghost" onClick={() => void ficha(r.id)}>Ficha</Button>{r.status !== 'cancelada' ? <Button variant="ghost" onClick={() => void cancelar(r.id)}>Cancelar</Button> : null}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} wide title="Nova programação de concretagem" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar programação'}</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Cliente*" value={val(form.client_id)} onChange={(e) => setForm((s) => ({ ...s, client_id: e.target.value, work_id: '' }))}><option value="">-</option>{(clientes.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
            <SelectField label="Obra*" value={val(form.work_id)} onChange={(e) => patch('work_id', e.target.value)}><option value="">-</option>{(obras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
            <SelectField label="Traço cadastrado" value={val(form.operational_material_id)} onChange={(e) => { const id = e.target.value; const t = (tracos.data ?? []).find((x) => x.value === id); setForm((s) => ({ ...s, operational_material_id: id, fck_previsto: t?.fck ?? s.fck_previsto })); setPadrao(normalizePadroes(t?.padrao_moldagem ?? [], t?.fck ?? null)); }}><option value="">Manual</option>{(tracos.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}{o.fck != null ? ' · FCK ' + o.fck : ''}</option>)}</SelectField>
            {!form.operational_material_id ? <Field label="Traço manual" value={val(form.traco_texto)} onChange={(e) => patch('traco_texto', e.target.value)} /> : null}
            <Field label="FCK (MPa)" type="number" value={val(form.fck_previsto)} onChange={(e) => patch('fck_previsto', e.target.value)} />
            <Field label="Fornecedor / central" value={val(form.fornecedor_texto)} onChange={(e) => patch('fornecedor_texto', e.target.value)} />
            <Field label="Data prevista" type="date" value={val(form.data_programada)} onChange={(e) => patch('data_programada', e.target.value)} />
            <Field label="Hora prevista" type="time" value={val(form.hora_programada)} onChange={(e) => patch('hora_programada', e.target.value)} />
            <Field label="Volume previsto (m³)" type="number" value={val(form.volume_programado_m3)} onChange={(e) => patch('volume_programado_m3', e.target.value)} />
            <Field label="Local / peça" value={val(form.local_texto)} onChange={(e) => patch('local_texto', e.target.value)} />
            <SelectField label="Dimensão CP" value={val(form.dimensao_cp)} onChange={(e) => patch('dimensao_cp', e.target.value)}><option value="100x200">100 x 200 mm</option><option value="150x300">150 x 300 mm</option></SelectField>
            <SelectField label="Moldador" value={val(form.moldador_id)} onChange={(e) => patch('moldador_id', e.target.value)}><option value="">A definir</option>{(moldadores.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</SelectField>
          </div>
          <TextArea label="Observações de acesso / logística" value={val(form.observacoes)} onChange={(e) => patch('observacoes', e.target.value)} />
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3"><h3 className="font-black text-slate-950 dark:text-slate-50">Padrão de moldagem previsto</h3><p className="text-xs text-slate-500">Será copiado para a concretagem e poderá ser carregado em cada caminhão.</p></div><MoldingStandardEditor value={padrao} onChange={setPadrao} fck={num(form.fck_previsto)} /></div>
        </div>
      </Modal>
    </section>
  );
}
