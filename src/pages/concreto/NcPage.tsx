import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { listNcs, listAcoes, listTemplates, listTransitions, listSituacoes, listTipos, listObrasRef, abrirNcManual, registrarAcao, excluirNc, uploadAnexo, signedAnexo, type NcRow } from '../../lib/api/nc';

const dataBR = (s: string) => (s && s.length === 10 ? s.split('-').reverse().join('/') : s);
const SEV: Record<string, string> = { alta: 'var(--magenta)', media: '#d97706', baixa: 'var(--ink-faint)' };
const STBADGE: Record<string, { label: string; color: string }> = {
  aberta: { label: 'Aberta', color: '#d97706' },
  concluida: { label: 'Concluida', color: '#16a34a' },
};

export function NcPage() {
  const { member, hasRole } = useAuth();
  const qc = useQueryClient();
  const podeTratar = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista');
  const [status, setStatus] = useState('');
  const [obra, setObra] = useState('');
  const [sel, setSel] = useState<NcRow | null>(null);
  const [novo, setNovo] = useState(false);

  const obras = useQuery({ queryKey: ['nc-obras'], queryFn: listObrasRef });
  const situ = useQuery({ queryKey: ['nc-situacoes'], queryFn: listSituacoes });
  const ncs = useQuery({ queryKey: ['ncs', status, obra], queryFn: () => listNcs({ status: status || undefined, work_id: obra || undefined }) });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Controle tecnologico" title="Nao-conformidades" description="Registro e tratativa de NCs (engine configuravel). Geradas automaticamente (resultado abaixo do fck na idade de controle, slump, calibracao, CP atrasado) ou abertas manualmente; tratadas por acoes com transicoes." />

      <Card className="p-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 180 }}>
              <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option><option value="aberta">Abertas</option><option value="concluida">Concluidas</option>
              </SelectField>
            </div>
            <div style={{ minWidth: 220 }}>
              <SelectField label="Obra" value={obra} onChange={(e) => setObra(e.target.value)}>
                <option value="">Todas as obras</option>
                {(obras.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </SelectField>
            </div>
          </div>
          {podeTratar ? <Button onClick={() => setNovo(true)}>Nova NC manual</Button> : null}
        </div>
        {ncs.isLoading ? <LoadingState /> : ncs.isError ? <ErrorState message={(ncs.error as Error).message} /> : (ncs.data ?? []).length === 0 ? <EmptyState /> : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Numero</th><th>Tipo</th><th>Classificacao</th><th>Obra</th><th>Origem</th><th>Sev.</th><th>Status</th><th>Abertura</th><th></th></tr></thead>
              <tbody>{(ncs.data ?? []).map((n) => {
                const st = STBADGE[n.status] ?? { label: n.status, color: 'var(--ink-faint)' };
                return (
                  <tr key={n.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{n.numero}</td>
                    <td>{n.tipo_nome ?? n.tipo_code ?? '—'}</td>
                    <td style={{ color: 'var(--ink-faint)' }}>{n.classification_nome ?? n.classification_code ?? '—'}</td>
                    <td>{n.obra}</td>
                    <td style={{ color: 'var(--ink-faint)' }}>{n.origem === 'automatica' ? 'Automatica' : 'Manual'}</td>
                    <td style={{ fontWeight: 700, color: SEV[n.severidade] ?? 'var(--ink-faint)' }}>{n.severidade}</td>
                    <td style={{ fontWeight: 700, color: st.color }}>{st.label}</td>
                    <td>{dataBR(n.data_abertura)}</td>
                    <td style={{ textAlign: 'right' }}><Button variant="ghost" onClick={() => setSel(n)}>Abrir</Button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>

      {sel ? <NcDetalhe nc={sel} situ={situ.data ?? {}} podeTratar={podeTratar} onClose={() => setSel(null)} onChange={() => { void qc.invalidateQueries({ queryKey: ['ncs'] }); }} /> : null}
      {novo ? <NovaNcModal tenantId={member?.tenant_id ?? ''} onClose={() => setNovo(false)} onSaved={() => { setNovo(false); void qc.invalidateQueries({ queryKey: ['ncs'] }); }} /> : null}
    </div>
  );
}

function NcDetalhe({ nc, situ, podeTratar, onClose, onChange }: { nc: NcRow; situ: Record<string, string>; podeTratar: boolean; onClose: () => void; onChange: () => void }) {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const cls = nc.classification_code ?? '';
  const acoes = useQuery({ queryKey: ['nc-acoes', nc.id], queryFn: () => listAcoes(nc.id) });
  const templates = useQuery({ queryKey: ['nc-templates', cls], queryFn: () => listTemplates(cls), enabled: !!cls });
  const transitions = useQuery({ queryKey: ['nc-transitions'], queryFn: listTransitions });
  const [tmpl, setTmpl] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anotacao, setAnotacao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const concluida = nc.status === 'concluida';
  const lastTemplateId = useMemo(() => { const a = acoes.data ?? []; return a.length ? a[a.length - 1].action_template_id : null; }, [acoes.data]);
  const allowed = useMemo(() => {
    const all = templates.data ?? [];
    if (!lastTemplateId) return all;
    const tos = new Set((transitions.data ?? []).filter((t) => t.from_action_id === lastTemplateId).map((t) => t.to_action_id));
    return all.filter((t) => tos.has(t.id));
  }, [templates.data, transitions.data, lastTemplateId]);
  const tmplObj = (templates.data ?? []).find((t) => t.id === tmpl);

  async function registrar() {
    if (!tmpl || !member) { toast('Escolha a acao.', 'error'); return; }
    setBusy(true);
    try {
      const cd: Record<string, unknown> = {}; if (anotacao.trim()) cd.anotacao = anotacao.trim();
      if (file) { const up = await uploadAnexo(member.tenant_id, nc.id, file); cd.arquivo = up.path; cd.arquivo_nome = up.nome; }
      const r = await registrarAcao({ nc_id: nc.id, action_template_id: tmpl, descricao: descricao || undefined, campos_dinamicos: cd });
      await qc.invalidateQueries({ queryKey: ['nc-acoes', nc.id] });
      onChange();
      setTmpl(''); setDescricao(''); setAnotacao(''); setFile(null);
      toast(r?.concluida ? 'Acao registrada — NC concluida.' : 'Acao registrada.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function baixar(path: string) {
    try { const url = await signedAnexo(path); window.open(url, '_blank'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function excluir() {
    if (!window.confirm('Excluir esta NC?')) return;
    try { await excluirNc(nc.id); onChange(); onClose(); toast('NC excluida.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <Modal open title={'NC ' + nc.numero} onClose={onClose} wide footer={<><Button variant="ghost" onClick={onClose}>Fechar</Button>{podeTratar ? <Button variant="ghost" onClick={() => void excluir()}>Excluir NC</Button> : null}</>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <KV k="Tipo" v={nc.tipo_nome ?? nc.tipo_code ?? '—'} />
          <KV k="Classificacao" v={nc.classification_nome ?? '—'} />
          <KV k="Obra" v={nc.obra || '—'} />
          <KV k="Origem" v={nc.origem === 'automatica' ? 'Automatica' : 'Manual'} />
          <KV k="Severidade" v={nc.severidade} />
          <KV k="Status" v={concluida ? 'Concluida' : 'Aberta'} />
        </div>
        {nc.descricao ? <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{nc.descricao}</div> : null}

        <div>
          <h3 className="text-sm font-black" style={{ marginBottom: 8 }}>Tratativa</h3>
          {acoes.isLoading ? <LoadingState /> : (acoes.data ?? []).length === 0 ? <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Nenhuma acao registrada ainda.</p> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {(acoes.data ?? []).map((a) => (
                <div key={a.id} style={{ borderLeft: '2px solid var(--line)', paddingLeft: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.template_nome} <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>· {situ[a.situacao_codigo ?? ''] ?? a.situacao_codigo} · {dataBR(String(a.executada_em ?? a.created_at).slice(0, 10))}</span></div>
                  {a.descricao ? <div style={{ fontSize: 13 }}>{a.descricao}</div> : null}
                  {a.campos_dinamicos?.anotacao ? <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{String(a.campos_dinamicos.anotacao)}</div> : null}
                  {a.campos_dinamicos?.arquivo ? <button type="button" onClick={() => void baixar(String(a.campos_dinamicos.arquivo))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--magenta)', fontWeight: 700, fontSize: 12, padding: 0 }}>Baixar anexo{a.campos_dinamicos.arquivo_nome ? ' (' + String(a.campos_dinamicos.arquivo_nome) + ')' : ''}</button> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {podeTratar && !concluida ? (
          <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <SelectField label="Registrar acao" value={tmpl} onChange={(e) => setTmpl(e.target.value)}>
              <option value="">Selecione...</option>
              {allowed.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.conclui_nc ? ' (conclui)' : ''}</option>)}
            </SelectField>
            {tmplObj?.mensagem ? <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{tmplObj.mensagem}</p> : null}
            <Field label="Descricao (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            <TextArea label="Anotacao" value={anotacao} onChange={(e) => setAnotacao(e.target.value)} />
            <label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Anexo (opcional)</span><input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <div><Button onClick={() => void registrar()} disabled={busy || !tmpl}>{busy ? 'Registrando...' : 'Registrar acao'}</Button></div>
          </div>
        ) : concluida ? <p className="text-sm" style={{ color: '#16a34a', fontWeight: 700 }}>NC concluida.</p> : null}
      </div>
    </Modal>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return <div><div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div></div>;
}

function NovaNcModal({ tenantId, onClose, onSaved }: { tenantId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const obras = useQuery({ queryKey: ['nc-obras'], queryFn: listObrasRef });
  const tipos = useQuery({ queryKey: ['nc-tipos'], queryFn: listTipos });
  const [work, setWork] = useState('');
  const [tipo, setTipo] = useState('');
  const [sev, setSev] = useState('media');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  async function salvar() {
    if (!tenantId || !work || !tipo) { toast('Obra e tipo sao obrigatorios.', 'error'); return; }
    if (!desc.trim()) { toast('Descricao obrigatoria.', 'error'); return; }
    setBusy(true);
    try { await abrirNcManual(tenantId, { work_id: work, tipo_code: tipo, descricao: desc.trim(), severidade: sev }); toast('NC aberta.', 'success'); onSaved(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <Modal open title="Nova NC manual" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Abrindo...' : 'Abrir NC'}</Button></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <SelectField label="Obra" value={work} onChange={(e) => setWork(e.target.value)}>
          <option value="">-</option>{(obras.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </SelectField>
        <SelectField label="Tipo de NC" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">-</option>{(tipos.data ?? []).map((t) => <option key={t.codigo} value={t.codigo}>{t.codigo} — {t.nome}</option>)}
        </SelectField>
        <SelectField label="Severidade" value={sev} onChange={(e) => setSev(e.target.value)}>
          <option value="baixa">Baixa</option><option value="media">Media</option><option value="alta">Alta</option>
        </SelectField>
        <TextArea label="Descricao" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
    </Modal>
  );
}
