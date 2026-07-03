import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, EmptyState } from '../../components/ui/State';
import { listReference } from '../../lib/api/client';
import { listObrasEstrutura, listGrupos, listTipos, listPecas, addEstrutura, delEstrutura } from '../../lib/api/estrutura';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => { const s = String(v ?? '').trim(); return s === '' ? null : Number(s); };

export function EstruturaPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [work, setWork] = useState('');
  const [g, setG] = useState<Record<string, unknown>>({});
  const [t, setT] = useState<Record<string, unknown>>({});
  const [p, setP] = useState<Record<string, unknown>>({});

  const obras = useQuery({ queryKey: ['obras-estrutura'], queryFn: listObrasEstrutura });
  const grupos = useQuery({ queryKey: ['grupos', work], queryFn: () => listGrupos(work), enabled: !!work });
  const tipos = useQuery({ queryKey: ['tipos', work], queryFn: () => listTipos(work), enabled: !!work });
  const pecas = useQuery({ queryKey: ['pecas', work], queryFn: () => listPecas(work), enabled: !!work });
  const tracos = useQuery({ queryKey: ['ref', 'operational_materials', 'estrutura'], queryFn: () => listReference('operational_materials', 'nome'), enabled: !!work });

  const gMap = new Map((grupos.data ?? []).map((x) => [x.id, x.nome]));
  const tMap = new Map((tipos.data ?? []).map((x) => [x.id, x.nome]));

  async function add(table: string, values: Record<string, unknown>, key: string, reset: () => void) {
    if (!member || !work) return;
    try {
      if (!str(values.codigo) || !str(values.nome)) throw new Error('Codigo e nome sao obrigatorios.');
      await addEstrutura(table, member.tenant_id, work, values);
      await qc.invalidateQueries({ queryKey: [key, work] }); reset(); toast('Adicionado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function rm(table: string, id: string, key: string) {
    if (!(await confirm({ title: 'Remover item', message: 'Remover este item da estrutura? Itens vinculados (tipos/peças) podem ficar sem referência.', danger: true, confirmLabel: 'Remover' }))) return;
    try { await delEstrutura(table, id); await qc.invalidateQueries({ queryKey: [key, work] }); } catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Cadastros" title="Estrutura da obra" description="Grupos, tipos e pecas (opcional, para obras com estrutura habilitada)." />
      <Card><div style={{ padding: 16 }}>
        <SelectField label="Obra (com estrutura habilitada)" value={work} onChange={(e) => setWork(e.target.value)}>
          <option value="">Selecione...</option>
          {(obras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        {!obras.isLoading && (obras.data ?? []).length === 0 ? <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '8px 0 0' }}>Nenhuma obra com estrutura habilitada. Ligue em Cadastros &gt; Obras (ou na Nova obra).</p> : null}
      </div></Card>

      {!work ? null : (
        <>
          <Card>
            <CardHeader kicker="Nivel 1" title="Grupos (ex.: Torre A, Bloco 1)" />
            <div style={{ display: 'grid', gap: 8, padding: 16 }}>
              {grupos.isLoading ? <LoadingState /> : (grupos.data ?? []).length === 0 ? <EmptyState /> : (grupos.data ?? []).map((x) => (
                <div key={x.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
                  <span><strong>{x.codigo}</strong> - {x.nome}{x.tipo_edificacao ? ' · ' + x.tipo_edificacao : ''}</span>
                  <Button variant="ghost" onClick={() => void rm('unit_groups', x.id, 'grupos')}>remover</Button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <Field label="Codigo*" value={String(g.codigo ?? '')} onChange={(e) => setG((s) => ({ ...s, codigo: e.target.value }))} />
                <Field label="Nome*" value={String(g.nome ?? '')} onChange={(e) => setG((s) => ({ ...s, nome: e.target.value }))} />
                <Field label="Tipo edificacao" value={String(g.tipo_edificacao ?? '')} onChange={(e) => setG((s) => ({ ...s, tipo_edificacao: e.target.value }))} />
                <Button variant="secondary" onClick={() => void add('unit_groups', { codigo: str(g.codigo), nome: str(g.nome), tipo_edificacao: str(g.tipo_edificacao) || null }, 'grupos', () => setG({}))}>Adicionar grupo</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader kicker="Nivel 2" title="Tipos (ex.: Pilar P1, Laje L2) - fck do traco" />
            <div style={{ display: 'grid', gap: 8, padding: 16 }}>
              {tipos.isLoading ? <LoadingState /> : (tipos.data ?? []).length === 0 ? <EmptyState /> : (tipos.data ?? []).map((x) => (
                <div key={x.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
                  <span><strong>{x.codigo}</strong> - {x.nome}{x.etapa ? ' · ' + x.etapa : ''}{x.volume_projeto_m3 != null ? ' · ' + x.volume_projeto_m3 + ' m3' : ''}</span>
                  <Button variant="ghost" onClick={() => void rm('unit_types', x.id, 'tipos')}>remover</Button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <Field label="Codigo*" value={String(t.codigo ?? '')} onChange={(e) => setT((s) => ({ ...s, codigo: e.target.value }))} />
                <Field label="Nome*" value={String(t.nome ?? '')} onChange={(e) => setT((s) => ({ ...s, nome: e.target.value }))} />
                <Field label="Etapa" value={String(t.etapa ?? '')} onChange={(e) => setT((s) => ({ ...s, etapa: e.target.value }))} />
                <Field label="Volume (m3)" type="number" value={String(t.volume ?? '')} onChange={(e) => setT((s) => ({ ...s, volume: e.target.value }))} />
                <SelectField label="Traco" value={String(t.traco ?? '')} onChange={(e) => setT((s) => ({ ...s, traco: e.target.value }))}><option value="">-</option>{(tracos.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
                <Button variant="secondary" onClick={() => void add('unit_types', { codigo: str(t.codigo), nome: str(t.nome), etapa: str(t.etapa) || null, volume_projeto_m3: num(t.volume), operational_material_id: str(t.traco) || null }, 'tipos', () => setT({}))}>Adicionar tipo</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader kicker="Nivel 3" title="Pecas (ex.: P1 - Torre A - Pav 3)" />
            <div style={{ display: 'grid', gap: 8, padding: 16 }}>
              {pecas.isLoading ? <LoadingState /> : (pecas.data ?? []).length === 0 ? <EmptyState /> : (pecas.data ?? []).map((x) => (
                <div key={x.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
                  <span><strong>{x.codigo}</strong> - {x.nome}{x.unit_group_id ? ' · ' + (gMap.get(x.unit_group_id) ?? '') : ''}{x.unit_type_id ? ' · ' + (tMap.get(x.unit_type_id) ?? '') : ''}</span>
                  <Button variant="ghost" onClick={() => void rm('units', x.id, 'pecas')}>remover</Button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <Field label="Codigo*" value={String(p.codigo ?? '')} onChange={(e) => setP((s) => ({ ...s, codigo: e.target.value }))} />
                <Field label="Nome*" value={String(p.nome ?? '')} onChange={(e) => setP((s) => ({ ...s, nome: e.target.value }))} />
                <SelectField label="Grupo" value={String(p.grupo ?? '')} onChange={(e) => setP((s) => ({ ...s, grupo: e.target.value }))}><option value="">-</option>{(grupos.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</SelectField>
                <SelectField label="Tipo" value={String(p.tipo ?? '')} onChange={(e) => setP((s) => ({ ...s, tipo: e.target.value }))}><option value="">-</option>{(tipos.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</SelectField>
                <Field label="Volume (m3)" type="number" value={String(p.volume ?? '')} onChange={(e) => setP((s) => ({ ...s, volume: e.target.value }))} />
                <Button variant="secondary" onClick={() => void add('units', { codigo: str(p.codigo), nome: str(p.nome), unit_group_id: str(p.grupo) || null, unit_type_id: str(p.tipo) || null, volume_m3: num(p.volume) }, 'pecas', () => setP({}))}>Adicionar peca</Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
