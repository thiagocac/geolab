import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { listClassificacoes } from '../../lib/api/nc';
import { getParametros, salvarParametros, listTemplatesFull, updateTemplate, listTransitions, addTransition, removeTransition, type NcParams, type TemplateFull } from '../../lib/api/ncConfig';

export function NcConfigPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const podeTol = hasRole('admin', 'admin_consulte', 'gestor_qualidade');
  const podeTpl = hasRole('admin', 'admin_consulte');

  const params = useQuery({ queryKey: ['nc-params'], queryFn: getParametros });
  const [p, setP] = useState<NcParams | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = p ?? params.data ?? null;
  function set<K extends keyof NcParams>(k: K, v: string) { setP({ ...(cur as NcParams), [k]: v }); }

  async function salvar() {
    if (!member || !cur) return;
    setBusy(true);
    try { await salvarParametros(member.tenant_id, cur); await qc.invalidateQueries({ queryKey: ['nc-params'] }); setP(null); toast('Parametros salvos.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  const cls = useQuery({ queryKey: ['nc-cls'], queryFn: listClassificacoes });
  const [clsSel, setClsSel] = useState('');
  const clsAtivo = clsSel || (cls.data ?? [])[0]?.codigo || '';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Gestao" title="Configuracao de NC" description="Parametros de tolerancia lidos pelos gatilhos automaticos e o fluxo de tratativa (acoes e transicoes) do motor de nao-conformidades." />

      <Card className="p-5">
        <h2 className="text-lg font-black text-slate-950 dark:text-slate-50" style={{ marginBottom: 4 }}>Tolerancias</h2>
        <p className="text-sm" style={{ color: 'var(--ink-faint)', marginBottom: 14 }}>Em uso hoje: <b>validade do concreto</b> (gatilho T-01). Os demais ficam preparados para autoconclusao e gatilhos futuros.</p>
        {params.isLoading ? <LoadingState /> : params.isError ? <ErrorState message={(params.error as Error).message} /> : cur ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="Validade do concreto (h)" type="number" step="0.5" value={cur.validade_concreto_h} onChange={(e) => set('validade_concreto_h', e.target.value)} disabled={!podeTol} hint="T-01: tempo de transporte acima disso gera NC." />
            <Field label="Tolerancia de slump (mm)" type="number" value={cur.slump_tol_mm} onChange={(e) => set('slump_tol_mm', e.target.value)} disabled={!podeTol} />
            <Field label="Tolerancia de flow (mm)" type="number" value={cur.flow_tol_mm} onChange={(e) => set('flow_tol_mm', e.target.value)} disabled={!podeTol} />
            <Field label="Conclusao automatica (% do fck)" type="number" step="0.1" value={cur.conclusao_auto_pct} onChange={(e) => set('conclusao_auto_pct', e.target.value)} disabled={!podeTol} hint="Para autoconclusao por tolerancia (futuro)." />
            <Field label="Acao imediata (% do fck)" type="number" step="0.1" value={cur.acao_imediata_pct} onChange={(e) => set('acao_imediata_pct', e.target.value)} disabled={!podeTol} />
            <Field label="Tolerancia de lancamento (min)" type="number" value={cur.tolerancia_lancamento_min} onChange={(e) => set('tolerancia_lancamento_min', e.target.value)} disabled={!podeTol} />
          </div>
        ) : null}
        {podeTol ? <div style={{ marginTop: 14 }}><Button onClick={() => void salvar()} disabled={busy || !p}>{busy ? 'Salvando...' : 'Salvar tolerancias'}</Button></div> : null}
      </Card>

      <Card className="p-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Fluxo de tratativa</h2>
          <div style={{ minWidth: 260 }}>
            <SelectField label="Classificacao" value={clsAtivo} onChange={(e) => setClsSel(e.target.value)}>
              {(cls.data ?? []).map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nome}</option>)}
            </SelectField>
          </div>
        </div>
        {clsAtivo ? <FluxoClassificacao cls={clsAtivo} tenantId={member?.tenant_id ?? ''} podeEditar={podeTpl} /> : null}
        {!podeTpl ? <p className="text-sm" style={{ color: 'var(--ink-faint)', marginTop: 10 }}>Edicao do fluxo restrita ao administrador.</p> : null}
      </Card>
    </div>
  );
}

function FluxoClassificacao({ cls, tenantId, podeEditar }: { cls: string; tenantId: string; podeEditar: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const tpls = useQuery({ queryKey: ['nc-tpls', cls], queryFn: () => listTemplatesFull(cls) });
  const trans = useQuery({ queryKey: ['nc-trans'], queryFn: listTransitions });
  const [edit, setEdit] = useState<TemplateFull | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const lista = tpls.data ?? [];
  const nameById = useMemo(() => { const m: Record<string, string> = {}; for (const t of lista) m[t.id] = t.nome; return m; }, [lista]);
  const ids = useMemo(() => new Set(lista.map((t) => t.id)), [lista]);
  const edges = useMemo(() => (trans.data ?? []).filter((e) => ids.has(e.from_action_id) && ids.has(e.to_action_id)), [trans.data, ids]);

  async function add() {
    if (!from || !to || from === to) { toast('Escolha origem e destino diferentes.', 'error'); return; }
    setBusy(true);
    try { await addTransition(tenantId, from, to); await qc.invalidateQueries({ queryKey: ['nc-trans'] }); setFrom(''); setTo(''); toast('Transicao adicionada.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function rem(id: string) {
    try { await removeTransition(id); await qc.invalidateQueries({ queryKey: ['nc-trans'] }); toast('Transicao removida.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  if (tpls.isLoading) return <LoadingState />;
  if (tpls.isError) return <ErrorState message={(tpls.error as Error).message} />;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>Acao</th><th>Situacao destino</th><th>Conclui</th><th>Multipla</th><th>Ativo</th><th></th></tr></thead>
          <tbody>{lista.map((t) => (
            <tr key={t.id} style={{ opacity: t.ativo ? 1 : 0.5 }}>
              <td style={{ fontWeight: 700 }}>{t.nome}{t.mensagem ? <div className="text-sm" style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{t.mensagem}</div> : null}</td>
              <td>{t.situacao_destino ?? '—'}</td>
              <td>{t.conclui_nc ? 'Sim' : '—'}</td>
              <td>{t.permite_multipla_acao ? 'Sim' : '—'}</td>
              <td style={{ color: t.ativo ? '#16a34a' : 'var(--ink-faint)', fontWeight: 700 }}>{t.ativo ? 'Ativo' : 'Inativo'}</td>
              <td style={{ textAlign: 'right' }}>{podeEditar ? <Button variant="ghost" onClick={() => setEdit(t)}>Editar</Button> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div>
        <div className="text-sm font-black" style={{ marginBottom: 6 }}>Transicoes permitidas</div>
        {edges.length === 0 ? <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Sem transicoes.</p> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {edges.map((e) => (
              <span key={e.id} className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 999, padding: '3px 6px 3px 10px' }}>
                {nameById[e.from_action_id]} → {nameById[e.to_action_id]}
                {podeEditar ? <button type="button" onClick={() => void rem(e.id)} title="Remover" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--magenta)', fontWeight: 800, lineHeight: 1 }}>×</button> : null}
              </span>
            ))}
          </div>
        )}
        {podeEditar ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
            <div style={{ minWidth: 200 }}><SelectField label="De" value={from} onChange={(e) => setFrom(e.target.value)}><option value="">-</option>{lista.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</SelectField></div>
            <div style={{ minWidth: 200 }}><SelectField label="Para" value={to} onChange={(e) => setTo(e.target.value)}><option value="">-</option>{lista.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</SelectField></div>
            <Button variant="secondary" onClick={() => void add()} disabled={busy || !from || !to}>Adicionar transicao</Button>
          </div>
        ) : null}
      </div>

      {edit ? <EditTemplate t={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void qc.invalidateQueries({ queryKey: ['nc-tpls', cls] }); }} /> : null}
    </div>
  );
}

function EditTemplate({ t, onClose, onSaved }: { t: TemplateFull; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(t.nome);
  const [msg, setMsg] = useState(t.mensagem ?? '');
  const [ativo, setAtivo] = useState(t.ativo);
  const [multi, setMulti] = useState(t.permite_multipla_acao);
  const [busy, setBusy] = useState(false);
  async function salvar() {
    setBusy(true);
    try { await updateTemplate(t.id, { nome, mensagem: msg || null, ativo, permite_multipla_acao: multi }); toast('Template salvo.', 'success'); onSaved(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Modal open title={'Editar acao — ' + t.nome} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="Nome da acao" value={nome} onChange={(e) => setNome(e.target.value)} />
        <TextArea label="Mensagem (orientacao ao tratar)" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14 }}><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14 }}><input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Permite multipla aplicacao</label>
        <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Situacao destino e editavel em fase futura.</p>
      </div>
    </Modal>
  );
}
