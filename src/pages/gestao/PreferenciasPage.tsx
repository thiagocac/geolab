import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { getConfigLab, saveConfigLab } from '../../lib/api/preferencias';

const num = (v: unknown, d: number): number => { const s = String(v ?? '').trim(); const n = Number(s); return s === '' || !isFinite(n) ? d : n; };
const str = (v: unknown) => String(v ?? '').trim();
const TOGGLES: [string, string, boolean][] = [
  ['usina', 'Mostrar central/usina', true],
  ['equipamentos', 'Bloco de equipamentos', true],
  ['carga', 'Coluna de carga (kN)', false],
  ['observacoes', 'Observacoes da concretagem', false],
  ['acreditacao', 'Acreditacao INMETRO', false],
  ['temperatura', 'Temperatura do concreto', false],
  ['moldador', 'Responsavel pela moldagem', false],
];

export function PreferenciasPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const podeEditar = hasRole('admin', 'admin_consulte');
  const [f, setF] = useState<Record<string, unknown>>({});
  const [lc, setLc] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['config-lab', member?.tenant_id], queryFn: () => getConfigLab(member!.tenant_id), enabled: !!member?.tenant_id });

  useEffect(() => {
    const c = q.data;
    if (c === undefined) return;
    setF({ responsavel_tecnico: c?.responsavel_tecnico ?? '', crea_rt: c?.crea_rt ?? '', acreditacao_inmetro: c?.acreditacao_inmetro ?? '', validade_acreditacao: c?.validade_acreditacao ?? '', idade_controle_default: c?.idade_controle_default ?? 28, cp_overdue_days: c?.cp_overdue_days ?? 2, nota_rodape: c?.nota_rodape ?? '' });
    const cur = (c?.laudo_campos ?? {}) as Record<string, boolean>;
    const init: Record<string, boolean> = {};
    for (const [k, , def] of TOGGLES) init[k] = cur[k] ?? def;
    setLc(init);
  }, [q.data]);

  function set(k: string, v: unknown) { setF((s) => ({ ...s, [k]: v })); }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      const existing = (q.data?.laudo_campos ?? {}) as Record<string, boolean>;
      await saveConfigLab(member.tenant_id, {
        responsavel_tecnico: str(f.responsavel_tecnico) || null, crea_rt: str(f.crea_rt) || null,
        acreditacao_inmetro: str(f.acreditacao_inmetro) || null, validade_acreditacao: str(f.validade_acreditacao) || null,
        idade_controle_default: num(f.idade_controle_default, 28), cp_overdue_days: num(f.cp_overdue_days, 2),
        nota_rodape: str(f.nota_rodape) || null, laudo_campos: { ...existing, ...lc },
      });
      toast('Preferencias salvas.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} />;
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
      <PageHeader kicker="Gestao" title="Preferencias do laboratorio" description="Dados do laudo, responsavel tecnico e regras de controle." />
      {!podeEditar ? <Card><p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Apenas o admin do laboratorio edita estas preferencias.</p></Card> : null}
      <Card>
        <CardHeader kicker="Responsavel tecnico / acreditacao" title="Identificacao no laudo" />
        <div style={{ display: 'grid', gap: 12, padding: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Responsavel tecnico" value={String(f.responsavel_tecnico ?? '')} onChange={(e) => set('responsavel_tecnico', e.target.value)} disabled={!podeEditar} />
            <Field label="CREA do RT" value={String(f.crea_rt ?? '')} onChange={(e) => set('crea_rt', e.target.value)} disabled={!podeEditar} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Acreditacao INMETRO" value={String(f.acreditacao_inmetro ?? '')} onChange={(e) => set('acreditacao_inmetro', e.target.value)} disabled={!podeEditar} />
            <Field label="Validade da acreditacao" type="date" value={String(f.validade_acreditacao ?? '')} onChange={(e) => set('validade_acreditacao', e.target.value)} disabled={!podeEditar} />
          </div>
          <Field label="Nota de rodape do laudo" value={String(f.nota_rodape ?? '')} onChange={(e) => set('nota_rodape', e.target.value)} disabled={!podeEditar} />
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>Logo do laboratorio: upload em versao futura (por ora o laudo usa o nome do lab).</p>
        </div>
      </Card>
      <Card>
        <CardHeader kicker="Regras de controle" title="Idades e atrasos" />
        <div style={{ display: 'flex', gap: 12, padding: 16 }}>
          <Field label="Idade de controle padrao (dias)" type="number" value={String(f.idade_controle_default ?? 28)} onChange={(e) => set('idade_controle_default', e.target.value)} disabled={!podeEditar} />
          <Field label="Tolerancia de atraso do CP (dias)" type="number" value={String(f.cp_overdue_days ?? 2)} onChange={(e) => set('cp_overdue_days', e.target.value)} disabled={!podeEditar} />
        </div>
      </Card>
      <Card>
        <CardHeader kicker="Laudo" title="Campos exibidos no laudo" />
        <div style={{ display: 'grid', gap: 8, padding: 16 }}>
          {TOGGLES.map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={!!lc[k]} disabled={!podeEditar} onChange={(e) => setLc((s) => ({ ...s, [k]: e.target.checked }))} /> {label}
            </label>
          ))}
        </div>
      </Card>
      {podeEditar ? <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar preferencias'}</Button></div> : null}
    </div>
  );
}
