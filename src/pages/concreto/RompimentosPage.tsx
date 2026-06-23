import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listAgenda, lancarResultado, maybeNotifyAbaixoFck, calcMPa, type CpPendente } from '../../lib/api/rompimento';
import { listReference } from '../../lib/api/client';

const hoje = () => new Date().toISOString().slice(0, 10);

function Grupo({ titulo, lista, cor, onRomper }: { titulo: string; lista: CpPendente[]; cor: string; onRomper: (c: CpPendente) => void }) {
  if (!lista.length) return null;
  return (
    <Card>
      <div style={{ fontWeight: 700, color: cor, marginBottom: 8 }}>{titulo} ({lista.length})</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {lista.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #eef0f3', borderRadius: 8 }}>
            <span style={{ fontSize: 13 }}><strong>{c.codigo ?? c.id.slice(0, 8)}</strong> - {c.idade_dias ?? '-'} {c.idade_unidade === 'hora' ? 'h' : 'd'} - {c.concretagens?.client_works?.nome ?? '-'} - prev {c.data_prevista_rompimento ?? '-'}</span>
            <Button onClick={() => onRomper(c)}>Romper</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RompimentosPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [cp, setCp] = useState<CpPendente | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['agenda'], queryFn: listAgenda });
  const equips = useQuery({ queryKey: ['ref', 'equipamentos'], queryFn: () => listReference('equipamentos', 'marca_modelo') });
  const operadores = useQuery({ queryKey: ['ref', 'colaboradores'], queryFn: () => listReference('colaboradores', 'nome') });

  function abrir(c: CpPendente) { setCp(c); setForm({ cp_diametro_mm: 100, cp_altura_mm: 200, data_rompimento: hoje() }); }

  async function salvar() {
    if (!member || !cp) return;
    setBusy(true);
    try {
      const carga = Number(form.carga_ruptura_kn);
      if (!carga || carga <= 0) throw new Error('Informe a carga de ruptura (kN).');
      const mpa = await lancarResultado(member.tenant_id, cp, {
        carga_ruptura_kn: carga, cp_diametro_mm: Number(form.cp_diametro_mm) || 100, cp_altura_mm: Number(form.cp_altura_mm) || 200,
        tipo_ruptura: form.tipo_ruptura ? String(form.tipo_ruptura) : undefined, capeamento: form.capeamento ? String(form.capeamento) : undefined,
        equipamento_id: form.equipamento_id ? String(form.equipamento_id) : null, operador_id: form.operador_id ? String(form.operador_id) : null,
        data_rompimento: String(form.data_rompimento || hoje()),
      });
      await maybeNotifyAbaixoFck(member.tenant_id, cp, cp.concretagens?.fck_previsto ?? null);
      await qc.invalidateQueries({ queryKey: ['agenda'] });
      toast('Resultado: ' + mpa + ' MPa.', 'success'); setCp(null); setForm({});
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  const rows = q.data ?? [];
  const t = hoje();
  const atrasados = rows.filter((r) => r.data_prevista_rompimento && r.data_prevista_rompimento < t);
  const dehoje = rows.filter((r) => r.data_prevista_rompimento === t);
  const proximos = rows.filter((r) => r.data_prevista_rompimento && r.data_prevista_rompimento > t);
  const semData = rows.filter((r) => !r.data_prevista_rompimento);
  const previa = cp && form.carga_ruptura_kn ? calcMPa(Number(form.carga_ruptura_kn), Number(form.cp_diametro_mm) || 100, Number(form.cp_altura_mm) || 200) : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concreto" title="Agenda de rompimentos" description="Corpos de prova pendentes de rompimento." />
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <>
          <Grupo titulo="Atrasados" lista={atrasados} cor="#C5117E" onRomper={abrir} />
          <Grupo titulo="Hoje" lista={dehoje} cor="#182863" onRomper={abrir} />
          <Grupo titulo="Proximos" lista={proximos} cor="#6b7280" onRomper={abrir} />
          <Grupo titulo="Sem data prevista" lista={semData} cor="#6b7280" onRomper={abrir} />
        </>
      )}
      <Modal open={!!cp} title={'Romper - ' + (cp?.codigo ?? '')} onClose={() => setCp(null)} footer={<><Button variant="ghost" onClick={() => setCp(null)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Lancar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Carga de ruptura (kN)" type="number" value={String(form.carga_ruptura_kn ?? '')} onChange={(e) => setForm((s) => ({ ...s, carga_ruptura_kn: e.target.value }))} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Diametro (mm)" type="number" value={String(form.cp_diametro_mm ?? '')} onChange={(e) => setForm((s) => ({ ...s, cp_diametro_mm: e.target.value }))} />
            <Field label="Altura (mm)" type="number" value={String(form.cp_altura_mm ?? '')} onChange={(e) => setForm((s) => ({ ...s, cp_altura_mm: e.target.value }))} />
          </div>
          <SelectField label="Tipo de ruptura" value={String(form.tipo_ruptura ?? '')} onChange={(e) => setForm((s) => ({ ...s, tipo_ruptura: e.target.value }))}><option value="">-</option>{['A', 'B', 'C', 'D', 'E', 'F'].map((x) => <option key={x} value={x}>{x}</option>)}</SelectField>
          <SelectField label="Equipamento" value={String(form.equipamento_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, equipamento_id: e.target.value }))}><option value="">-</option>{(equips.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Operador" value={String(form.operador_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, operador_id: e.target.value }))}><option value="">-</option>{(operadores.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <Field label="Data do rompimento" type="date" value={String(form.data_rompimento ?? '')} onChange={(e) => setForm((s) => ({ ...s, data_rompimento: e.target.value }))} />
          {previa != null ? <div style={{ fontWeight: 700, color: '#182863' }}>Resistencia estimada: {previa} MPa</div> : null}
        </div>
      </Modal>
    </div>
  );
}
