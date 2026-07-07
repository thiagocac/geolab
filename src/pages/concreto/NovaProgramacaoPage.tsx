import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { MoldingStandardEditor } from '../../components/domain/MoldingStandardEditor';
import { FornecedorDatalist, FORNECEDORES_DL } from '../../components/domain/FornecedorDatalist';
import { createConcretagem, listTracosComFck } from '../../lib/api/concretagem';
import { TracoOptions } from '../../components/TracoOptions';
import { listReference } from '../../lib/api/client';
import { filtrarPorFuncao, listColaboradoresRef } from '../../lib/api/colaboradores';
import { normalizePadroes, padroesMoldagemPadrao, padroesToDb, toNumber, type PadraoMoldagem } from '../../lib/concreto';

const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => toNumber(v as number | string | null | undefined);
const val = (v: unknown) => v == null ? '' : String(v);

export function NovaProgramacaoPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [form, setForm] = useState<Record<string, unknown>>({ origem: 'programada', dimensao_cp: '100x200', status: 'rascunho' });
  const [padrao, setPadrao] = useState<PadraoMoldagem[]>(padroesMoldagemPadrao(30));
  const [busy, setBusy] = useState(false);

  const clientes = useQuery({ queryKey: ['ref', 'lab_clients', 'prog'], queryFn: () => listReference('lab_clients', 'razao_social') });
  const obras = useQuery({ queryKey: ['ref', 'client_works', form.client_id, 'prog'], queryFn: () => listReference('client_works', 'nome', form.client_id ? { client_id: String(form.client_id) } : undefined), enabled: !!form.client_id });
  const tracos = useQuery({ queryKey: ['tracos-fck', form.work_id, form.client_id], queryFn: () => listTracosComFck(form.work_id ? String(form.work_id) : null, form.client_id ? String(form.client_id) : null) });
  const colabRef = useQuery({ queryKey: ['colaboradores-ref'], queryFn: listColaboradoresRef });
  const moldadores = filtrarPorFuncao(colabRef.data ?? [], 'Moldador');

  function patch(k: string, v: unknown) { setForm((s) => ({ ...s, [k]: v })); }

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
      nav('/concretagens/' + created.id, { viewTransition: true });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4">
      <nav className="flex items-center gap-2 text-sm">
        <button type="button" onClick={() => nav('/programacoes', { viewTransition: true })} className="font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">Programação</button>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-bold text-slate-900 dark:text-slate-100">Nova programação</span>
      </nav>
      <PageHeader kicker="Concreto · laboratório" title="Nova programação de concretagem" description="Defina cliente, obra, traço e logística. A confirmação transforma a programação em atendimento pronto para ficha e caminhões." />

      <Card className="p-5">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Cliente*" value={val(form.client_id)} onChange={(e) => setForm((s) => ({ ...s, client_id: e.target.value, work_id: '' }))}><option value="">-</option>{(clientes.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
            <SelectField label="Obra*" value={val(form.work_id)} onChange={(e) => patch('work_id', e.target.value)}><option value="">-</option>{(obras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
            <SelectField label="Traço cadastrado" value={val(form.operational_material_id)} onChange={(e) => { const id = e.target.value; const t = (tracos.data ?? []).find((x) => x.value === id); setForm((s) => ({ ...s, operational_material_id: id, fck_previsto: t?.fck ?? s.fck_previsto })); setPadrao(normalizePadroes(t?.padrao_moldagem ?? [], t?.fck ?? null)); }}><option value="">Manual</option><TracoOptions tracos={tracos.data ?? []} workId={form.work_id ? String(form.work_id) : null} clientId={form.client_id ? String(form.client_id) : null} /></SelectField>
            {!form.operational_material_id ? <Field label="Traço manual" value={val(form.traco_texto)} onChange={(e) => patch('traco_texto', e.target.value)} /> : null}
            {form.work_id ? <button type="button" className="justify-self-start text-xs font-bold text-blue-600" onClick={() => nav('/tracos?work=' + String(form.work_id))}>Gerenciar traços desta obra</button> : null}
            <Field label="FCK (MPa)" type="number" value={val(form.fck_previsto)} onChange={(e) => patch('fck_previsto', e.target.value)} />
            <Field label="Fornecedor / central" list={FORNECEDORES_DL} value={val(form.fornecedor_texto)} onChange={(e) => patch('fornecedor_texto', e.target.value)} />
            <Field label="Data prevista" type="date" value={val(form.data_programada)} onChange={(e) => patch('data_programada', e.target.value)} />
            <Field label="Hora prevista" type="time" value={val(form.hora_programada)} onChange={(e) => patch('hora_programada', e.target.value)} />
            <Field label="Volume previsto (m³)" type="number" value={val(form.volume_programado_m3)} onChange={(e) => patch('volume_programado_m3', e.target.value)} />
            <Field label="Local / peça" value={val(form.local_texto)} onChange={(e) => patch('local_texto', e.target.value)} />
            <SelectField label="Dimensão CP" value={val(form.dimensao_cp)} onChange={(e) => patch('dimensao_cp', e.target.value)}><option value="100x200">100 x 200 mm</option><option value="150x300">150 x 300 mm</option></SelectField>
            <SelectField label="Moldador" value={val(form.moldador_id)} onChange={(e) => patch('moldador_id', e.target.value)}><option value="">A definir</option>{moldadores.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</SelectField>
          </div>
          <TextArea label="Observações de acesso / logística" value={val(form.observacoes)} onChange={(e) => patch('observacoes', e.target.value)} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3"><h3 className="display text-slate-950 dark:text-slate-50">Padrão de moldagem previsto</h3><p className="text-xs text-slate-500 dark:text-slate-400">Será copiado para a concretagem e poderá ser carregado em cada caminhão.</p></div>
        <MoldingStandardEditor value={padrao} onChange={setPadrao} fck={num(form.fck_previsto)} />
      </Card>

      <div className="form-actions">
        <Button variant="ghost" onClick={() => nav('/programacoes', { viewTransition: true })}>Cancelar</Button>
        <Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar programação'}</Button>
      </div>
      <FornecedorDatalist />
    </section>
  );
}
