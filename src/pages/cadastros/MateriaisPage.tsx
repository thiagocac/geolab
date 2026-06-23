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
import { listTracos, saveTraco, softDeleteTraco, type TracoRow, type PadraoIdade } from '../../lib/api/materiais';

const num = (v: unknown): number | null => { const s = String(v ?? '').trim(); return s === '' ? null : Number(s); };
const str = (v: unknown): string => String(v ?? '').trim();
const ATALHOS: PadraoIdade[] = [
  { idade: 12, unidade: 'hora', quantidade: 2 }, { idade: 24, unidade: 'hora', quantidade: 2 },
  { idade: 3, unidade: 'dia', quantidade: 2 }, { idade: 7, unidade: 'dia', quantidade: 2 },
  { idade: 28, unidade: 'dia', quantidade: 2 }, { idade: 63, unidade: 'dia', quantidade: 2 },
];

export function MateriaisPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [padrao, setPadrao] = useState<PadraoIdade[]>([]);
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['tracos'], queryFn: listTracos });

  function novo() { setEditId(null); setF({ condicao_preparo: 'A' }); setPadrao([{ idade: 28, unidade: 'dia', quantidade: 2 }]); setOpen(true); }
  function editar(t: TracoRow) {
    setEditId(t.id);
    setF({ codigo: t.codigo, nome: t.nome, fck_mpa: t.fck_mpa ?? '', condicao_preparo: t.condicao_preparo ?? 'A', slump_previsto_cm: t.slump_previsto_cm ?? '', slump_tolerancia_cm: t.slump_tolerancia_cm ?? '', brita: t.brita ?? '', dmax_agregado_mm: t.dmax_agregado_mm ?? '', fator_ac: t.fator_ac ?? '', cimento_tipo: t.cimento_tipo ?? '', consumo_cimento_kg_m3: t.consumo_cimento_kg_m3 ?? '', aditivo_tipo: t.aditivo_tipo ?? '', metodo_cura: t.metodo_cura ?? '', bombeado: t.bombeado, observacoes: t.observacoes ?? '' });
    setPadrao(Array.isArray(t.padrao_moldagem) ? t.padrao_moldagem : []);
    setOpen(true);
  }
  function addIdade(p: PadraoIdade) { setPadrao((s) => [...s, p]); }
  function setIdade(i: number, patch: Partial<PadraoIdade>) { setPadrao((s) => s.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  function rmIdade(i: number) { setPadrao((s) => s.filter((_, idx) => idx !== i)); }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!str(f.codigo) || !str(f.nome)) throw new Error('Codigo e nome sao obrigatorios.');
      const payload = {
        codigo: str(f.codigo), nome: str(f.nome), fck_mpa: num(f.fck_mpa), condicao_preparo: str(f.condicao_preparo) || null,
        slump_previsto_cm: num(f.slump_previsto_cm), slump_tolerancia_cm: num(f.slump_tolerancia_cm),
        brita: str(f.brita) || null, dmax_agregado_mm: num(f.dmax_agregado_mm), fator_ac: num(f.fator_ac),
        cimento_tipo: str(f.cimento_tipo) || null, consumo_cimento_kg_m3: num(f.consumo_cimento_kg_m3),
        aditivo_tipo: str(f.aditivo_tipo) || null, metodo_cura: str(f.metodo_cura) || null,
        bombeado: !!f.bombeado, observacoes: str(f.observacoes) || null,
        padrao_moldagem: padrao.map((p) => ({ idade: Number(p.idade) || 0, unidade: p.unidade === 'hora' ? 'hora' : 'dia', quantidade: Number(p.quantidade) || 1 })),
      };
      await saveTraco(member.tenant_id, editId, payload);
      await qc.invalidateQueries({ queryKey: ['tracos'] });
      toast('Traco salvo.', 'success'); setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function excluir(t: TracoRow) {
    if (!window.confirm('Excluir o traco ' + t.codigo + '?')) return;
    try { await softDeleteTraco(t.id); await qc.invalidateQueries({ queryKey: ['tracos'] }); toast('Excluido.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  const rows = q.data ?? [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Cadastros" title="Materiais e ensaios" description="Tracos de concreto (fck, abatimento, padrao de moldagem)." />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={novo}>Novo traco</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <Card><div style={{ display: 'grid', gap: 6 }}>
          {rows.map((t) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #eef0f3', borderRadius: 8 }}>
              <span style={{ fontSize: 13 }}><strong>{t.codigo}</strong> - {t.nome} - fck {t.fck_mpa ?? '-'} MPa - {(t.padrao_moldagem?.length ?? 0)} idade(s){t.bombeado ? ' - bombeado' : ''}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="ghost" onClick={() => editar(t)}>Editar</Button>
                <Button variant="ghost" onClick={() => void excluir(t)}>Excluir</Button>
              </div>
            </div>
          ))}
        </div></Card>
      )}

      <Modal open={open} title={editId ? 'Editar traco' : 'Novo traco'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Codigo*" value={String(f.codigo ?? '')} onChange={(e) => setF((s) => ({ ...s, codigo: e.target.value }))} />
            <Field label="Nome*" value={String(f.nome ?? '')} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Fck (MPa)" type="number" value={String(f.fck_mpa ?? '')} onChange={(e) => setF((s) => ({ ...s, fck_mpa: e.target.value }))} />
            <SelectField label="Condicao de preparo" value={String(f.condicao_preparo ?? 'A')} onChange={(e) => setF((s) => ({ ...s, condicao_preparo: e.target.value }))}>{['A', 'B', 'C'].map((x) => <option key={x} value={x}>{x}</option>)}</SelectField>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Abatimento (cm)" type="number" value={String(f.slump_previsto_cm ?? '')} onChange={(e) => setF((s) => ({ ...s, slump_previsto_cm: e.target.value }))} />
            <Field label="Tolerancia (cm)" type="number" value={String(f.slump_tolerancia_cm ?? '')} onChange={(e) => setF((s) => ({ ...s, slump_tolerancia_cm: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Brita / agregado" value={String(f.brita ?? '')} onChange={(e) => setF((s) => ({ ...s, brita: e.target.value }))} />
            <Field label="Dmax (mm)" type="number" value={String(f.dmax_agregado_mm ?? '')} onChange={(e) => setF((s) => ({ ...s, dmax_agregado_mm: e.target.value }))} />
            <Field label="Fator a/c" type="number" value={String(f.fator_ac ?? '')} onChange={(e) => setF((s) => ({ ...s, fator_ac: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Cimento" value={String(f.cimento_tipo ?? '')} onChange={(e) => setF((s) => ({ ...s, cimento_tipo: e.target.value }))} />
            <Field label="Consumo cimento (kg/m3)" type="number" value={String(f.consumo_cimento_kg_m3 ?? '')} onChange={(e) => setF((s) => ({ ...s, consumo_cimento_kg_m3: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Field label="Metodo de cura" value={String(f.metodo_cura ?? '')} onChange={(e) => setF((s) => ({ ...s, metodo_cura: e.target.value }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#374151', marginTop: 18 }}>
              <input type="checkbox" checked={!!f.bombeado} onChange={(e) => setF((s) => ({ ...s, bombeado: e.target.checked }))} /> Bombeado
            </label>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 13, color: '#182863' }}>Padrao de moldagem (idades x CP)</strong>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ATALHOS.map((a) => <Button key={a.idade + a.unidade} variant="ghost" onClick={() => addIdade({ ...a })}>+{a.idade}{a.unidade === 'hora' ? 'h' : 'd'}</Button>)}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {padrao.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" value={String(p.idade)} onChange={(e) => setIdade(i, { idade: Number(e.target.value) })} className="input" style={{ width: 80 }} />
                  <select value={p.unidade} onChange={(e) => setIdade(i, { unidade: e.target.value === 'hora' ? 'hora' : 'dia' })} className="input" style={{ width: 90 }}><option value="dia">dias</option><option value="hora">horas</option></select>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>x</span>
                  <input type="number" value={String(p.quantidade)} onChange={(e) => setIdade(i, { quantidade: Number(e.target.value) })} className="input" style={{ width: 70 }} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>CP</span>
                  <Button variant="ghost" onClick={() => rmIdade(i)}>remover</Button>
                </div>
              ))}
              {padrao.length === 0 ? <span style={{ fontSize: 12, color: '#9ca3af' }}>Use os atalhos acima para adicionar idades.</span> : null}
            </div>
          </div>

          <Field label="Observacoes" value={String(f.observacoes ?? '')} onChange={(e) => setF((s) => ({ ...s, observacoes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
