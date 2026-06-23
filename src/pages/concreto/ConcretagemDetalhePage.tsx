import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { getConcretagem, listCaminhoes, listCpsDaConcretagem, addCaminhao, invokeFicha } from '../../lib/api/concretagem';

function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

export function ConcretagemDetalhePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  const conc = useQuery({ queryKey: ['concretagem', id], queryFn: () => getConcretagem(id), enabled: !!id });
  const cams = useQuery({ queryKey: ['caminhoes', id], queryFn: () => listCaminhoes(id), enabled: !!id });
  const cps = useQuery({ queryKey: ['cps', id], queryFn: () => listCpsDaConcretagem(id), enabled: !!id });

  async function salvar() {
    const c = conc.data;
    if (!member || !c) return;
    setBusy(true);
    try {
      if (!form.nota_fiscal) throw new Error('Nota fiscal e obrigatoria.');
      const serie = (cams.data?.length ?? 0) + 1;
      await addCaminhao(member.tenant_id, c, serie, form);
      await Promise.all([qc.invalidateQueries({ queryKey: ['caminhoes', id] }), qc.invalidateQueries({ queryKey: ['cps', id] })]);
      toast('Caminhao + amostra + CPs adicionados.', 'success'); setOpen(false); setForm({});
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function ficha() { try { dl(await invokeFicha(id), 'ficha-moldagem.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  if (conc.isLoading) return <LoadingState />;
  if (conc.isError || !conc.data) return <ErrorState message={conc.error ? (conc.error as Error).message : 'Concretagem nao encontrada'} />;
  const c = conc.data;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Button variant="ghost" onClick={() => nav('/concretagens')}>{'< Concretagens'}</Button>
      <PageHeader kicker="Concretagem" title={c.codigo ?? '(sem codigo)'} description={(c.lab_clients?.razao_social ?? '-') + ' - ' + (c.client_works?.nome ?? '-')} />
      <Card>
        <CardHeader title="Dados" kicker={c.status} />
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', display: 'grid', gap: 4 }}>
          <span>Traco: {c.operational_materials?.nome ?? '-'} - fck {c.fck_previsto ?? '-'} MPa</span>
          <span>Fornecedor: {c.fornecedor_texto ?? '-'} - Data: {c.data_programada ?? c.data_real ?? '-'}</span>
          <span>Local: {c.local_texto ?? '-'}</span>
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <strong>Caminhoes</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => void ficha()}>Gerar ficha PDF</Button>
          <Button onClick={() => { setForm({}); setOpen(true); }}>Adicionar caminhao</Button>
        </div>
      </div>
      {cams.isLoading ? <LoadingState /> : (cams.data?.length ?? 0) === 0 ? <EmptyState /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {(cams.data ?? []).map((cam) => {
            const cpsCam = (cps.data ?? []).filter((cp) => cp.receipt_id === cam.id);
            return (
              <div key={cam.id} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10, fontSize: 14 }}>
                <strong>Caminhao {cam.serie}</strong> - NF {cam.nota_fiscal} - {cam.volume_m3 ?? '-'} m3 - slump {cam.slump_medido_cm ?? '-'} cm - {cam.placa ?? '-'}
                {cpsCam.length ? (
                  <div style={{ marginTop: 8, display: 'grid', gap: 3 }}>
                    {cpsCam.map((cp) => (
                      <div key={cp.id} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 150, color: 'var(--ink-soft)' }}>{cp.codigo ?? cp.id.slice(0, 8)}</span>
                        <span style={{ width: 60, color: 'var(--ink-faint)' }}>{cp.idade_dias ?? '-'} {cp.idade_unidade === 'hora' ? 'h' : 'd'}</span>
                        <span style={{ width: 90, fontWeight: 700, color: cp.situacao === 'rompido' ? '#16a34a' : '#d97706' }}>{cp.situacao}</span>
                        <span style={{ width: 90, fontWeight: 700, color: 'var(--ink)' }}>{cp.resultado != null ? cp.resultado + ' MPa' : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-faint)' }}>Sem CPs.</div>}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={open} title="Adicionar caminhao" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nota fiscal" value={String(form.nota_fiscal ?? '')} onChange={(e) => setForm((s) => ({ ...s, nota_fiscal: e.target.value }))} />
          <Field label="Placa" value={String(form.placa ?? '')} onChange={(e) => setForm((s) => ({ ...s, placa: e.target.value }))} />
          <Field label="Volume (m3)" type="number" value={String(form.volume_m3 ?? '')} onChange={(e) => setForm((s) => ({ ...s, volume_m3: e.target.value === '' ? null : Number(e.target.value) }))} />
          <Field label="Slump (cm)" type="number" value={String(form.slump_medido_cm ?? '')} onChange={(e) => setForm((s) => ({ ...s, slump_medido_cm: e.target.value === '' ? null : Number(e.target.value) }))} />
          <Field label="Temperatura (C)" type="number" value={String(form.temperatura_concreto_c ?? '')} onChange={(e) => setForm((s) => ({ ...s, temperatura_concreto_c: e.target.value === '' ? null : Number(e.target.value) }))} />
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Ao salvar, gera a amostra e os CPs pelo padrao de moldagem do traco (default: 2 CP de 28 dias).</div>
        </div>
      </Modal>
    </div>
  );
}
