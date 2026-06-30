import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { getConfigLab, saveConfigLab, uploadLogo, logoSignedUrl } from '../../lib/api/preferencias';

const num = (v: unknown, d: number): number => { const s = String(v ?? '').trim(); const n = Number(s); return s === '' || !Number.isFinite(n) ? d : n; };
const str = (v: unknown) => String(v ?? '').trim();

export function PreferenciasPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const podeEditar = hasRole('admin', 'admin_consulte');
  const [f, setF] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['config-lab', member?.tenant_id], queryFn: () => getConfigLab(member!.tenant_id), enabled: !!member?.tenant_id });
  const qc = useQueryClient();
  const [logoBusy, setLogoBusy] = useState(false);
  const logoUrl = useQuery({ queryKey: ['logo-url', q.data?.logo_path], queryFn: () => logoSignedUrl(q.data!.logo_path!), enabled: !!q.data?.logo_path });
  async function handleLogo(file?: File) {
    if (!file || !member) return;
    setLogoBusy(true);
    try { const path = await uploadLogo(member.tenant_id, file); await saveConfigLab(member.tenant_id, { logo_path: path }); await qc.invalidateQueries({ queryKey: ['config-lab', member.tenant_id] }); toast('Logo atualizado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setLogoBusy(false); }
  }
  async function removeLogo() {
    if (!member) return;
    try { await saveConfigLab(member.tenant_id, { logo_path: null }); await qc.invalidateQueries({ queryKey: ['config-lab', member.tenant_id] }); toast('Logo removido.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }

  useEffect(() => {
    const c = q.data;
    if (c === undefined) return;
    setF({ responsavel_tecnico: c?.responsavel_tecnico ?? '', crea_rt: c?.crea_rt ?? '', acreditacao_inmetro: c?.acreditacao_inmetro ?? '', validade_acreditacao: c?.validade_acreditacao ?? '', idade_controle_default: c?.idade_controle_default ?? 28, cp_overdue_days: c?.cp_overdue_days ?? 2, nota_rodape: c?.nota_rodape ?? '', local_ensaio: c?.local_ensaio ?? '', art_numero: c?.art_numero ?? '', gerente_qualidade: c?.gerente_qualidade ?? '', crea_gq: c?.crea_gq ?? '' });
  }, [q.data]);

  function set(k: string, v: unknown) { setF((s) => ({ ...s, [k]: v })); }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      await saveConfigLab(member.tenant_id, {
        responsavel_tecnico: str(f.responsavel_tecnico) || null, crea_rt: str(f.crea_rt) || null,
        acreditacao_inmetro: str(f.acreditacao_inmetro) || null, validade_acreditacao: str(f.validade_acreditacao) || null,
        idade_controle_default: num(f.idade_controle_default, 28), cp_overdue_days: num(f.cp_overdue_days, 2),
        nota_rodape: str(f.nota_rodape) || null, local_ensaio: str(f.local_ensaio) || null, art_numero: str(f.art_numero) || null, gerente_qualidade: str(f.gerente_qualidade) || null, crea_gq: str(f.crea_gq) || null,
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
          <Field label="ART do RT" value={String(f.art_numero ?? '')} onChange={(e) => set('art_numero', e.target.value)} disabled={!podeEditar} />
          <Field label="Gerente da qualidade (2a assinatura)" value={String(f.gerente_qualidade ?? '')} onChange={(e) => set('gerente_qualidade', e.target.value)} disabled={!podeEditar} />
          <Field label="CREA do gerente da qualidade" value={String(f.crea_gq ?? '')} onChange={(e) => set('crea_gq', e.target.value)} disabled={!podeEditar} />
          <Field label="Local de realizacao dos ensaios" value={String(f.local_ensaio ?? '')} onChange={(e) => set('local_ensaio', e.target.value)} disabled={!podeEditar} />
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>Logo do laboratorio</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              {q.data?.logo_path && logoUrl.data ? <img src={logoUrl.data} alt="Logo" style={{ height: 48, maxWidth: 180, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 8, padding: 4, background: 'var(--surface)' }} /> : <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Sem logo (o laudo usa o nome do lab).</span>}
              {podeEditar ? <><input type="file" accept="image/png,image/jpeg" disabled={logoBusy} onChange={(e) => void handleLogo(e.target.files?.[0] ?? undefined)} />{q.data?.logo_path ? <Button variant="ghost" onClick={() => void removeLogo()}>Remover</Button> : null}</> : null}
            </div>
          </div>
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
        <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--ink-faint)' }}>Os campos exibidos no laudo (e os blocos/colunas do PDF) agora ficam em <b>Config. de Campos › aba Laudo</b> — junto com os campos de ensaio, recebimento e concretagem.</p>
      </Card>
      {podeEditar ? <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar preferencias'}</Button></div> : null}
    </div>
  );
}
