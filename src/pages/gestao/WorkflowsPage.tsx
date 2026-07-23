import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { useToast } from '../../lib/toast';
import { DelegacoesPage } from './DelegacoesPage';
import { listMembersForDelegation, listWorksForDelegation } from '../../lib/api/delegacoes';
import {
  FLOW_CATALOG, WORKFLOW_ROLES, WORKFLOW_ACTIONS,
  deleteWorkflowTemplate, listClientsForScope, listWorkflowGatilhos, listWorkflowTemplates,
  saveWorkflowGatilho, saveWorkflowTemplate, setTemplateActive,
  type FlowDef, type WorkflowGatilho, type WorkflowTemplate,
} from '../../lib/api/workflows';

// [W2] Workflows e delegações — configuração do motor de aprovação (Leva W1):
// Templates (etapas por fluxo, precedência obra > cliente > padrão do laboratório),
// Gatilhos (liga/desliga + parâmetros por tenant) e Delegações (página existente).

type Aba = 'templates' | 'gatilhos' | 'delegacoes';

export function WorkflowsPage() {
  const [sp, setSp] = useSearchParams();
  const aba = ((sp.get('aba') as Aba) || 'templates') as Aba;
  function trocar(k: Aba) {
    const n = new URLSearchParams(sp);
    n.set('aba', k);
    setSp(n, { replace: true });
  }
  return (
    <div className="space-y-6">
      <PageHeader kicker="Governança" title="Workflows e delegações" description="Motor de aprovação em etapas: templates configuráveis por fluxo (precedência obra > cliente > padrão do laboratório), gatilhos por laboratório e delegações temporárias." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant={aba === 'templates' ? 'primary' : 'ghost'} onClick={() => trocar('templates')}>Templates</Button>
        <Button variant={aba === 'gatilhos' ? 'primary' : 'ghost'} onClick={() => trocar('gatilhos')}>Gatilhos</Button>
        <Button variant={aba === 'delegacoes' ? 'primary' : 'ghost'} onClick={() => trocar('delegacoes')}>Delegações</Button>
      </div>
      {aba === 'templates' ? <TemplatesTab /> : aba === 'gatilhos' ? <GatilhosTab /> : <DelegacoesPage />}
    </div>
  );
}

function escopoLabel(t: WorkflowTemplate): string {
  if (t.work_id) return `Obra: ${t.work_nome || t.work_id}`;
  if (t.client_id) return `Cliente: ${t.client_nome || t.client_id}`;
  return 'Padrão do laboratório';
}

function TemplatesTab() {
  const { member, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [flow, setFlow] = useState<string>(FLOW_CATALOG[0].key);
  const [editor, setEditor] = useState<WorkflowTemplate | 'novo' | null>(null);
  const [excluir, setExcluir] = useState<WorkflowTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const def = FLOW_CATALOG.find((f) => f.key === flow) ?? FLOW_CATALOG[0];
  const q = useQuery({ queryKey: ['wf-templates', flow], queryFn: () => listWorkflowTemplates(flow), staleTime: 30_000 });
  const podeGerenciar = can('workflow.gerenciar');

  async function alternarAtivo(t: WorkflowTemplate) {
    setBusy(true);
    try {
      await setTemplateActive(t.id, !t.active);
      await qc.invalidateQueries({ queryKey: ['wf-templates'] });
      toast(t.active ? 'Template desativado.' : 'Template ativado.', 'success');
    } catch (e) {
      const m = (e as Error).message;
      toast(m.includes('wf_templates_scope_unique') || m.includes('duplicate') ? 'Já existe um template ativo para este fluxo neste escopo. Desative o outro primeiro.' : m, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setBusy(true);
    try {
      await deleteWorkflowTemplate(excluir.id);
      await qc.invalidateQueries({ queryKey: ['wf-templates'] });
      toast('Template excluído.', 'success');
      setExcluir(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader kicker="Fluxo" title="Templates de aprovação">Configure as etapas de cada fluxo. Só um template ativo por escopo; o mais específico (obra &gt; cliente) tem precedência sobre o padrão do laboratório.</CardHeader>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <SelectField label="Fluxo" value={flow} onChange={(e) => setFlow(e.target.value)}>
            {FLOW_CATALOG.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </SelectField>
          <div className="flex items-end justify-end">
            <Button onClick={() => setEditor('novo')} disabled={!podeGerenciar}>+ Novo template</Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">{def.hint}</p>
        </div>
      </Card>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState message={(q.error as Error).message} /> : (q.data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Sem templates para este fluxo. Crie o primeiro em “Novo template”.</Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(q.data ?? []).map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{t.nome}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{escopoLabel(t)}{t.is_default ? ' · seed automático' : ''}</p>
                </div>
                <span className={`badge ${t.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{t.active ? 'ativo' : 'inativo'}</span>
              </div>
              <div className="mt-3 space-y-1">
                {t.steps.map((s) => (
                  <p key={`${t.id}-${s.ordem}`} className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">{s.ordem}. {s.nome}</span> · papel {s.role_required} · SLA {s.sla_hours}h
                  </p>
                ))}
                {t.steps.length === 0 ? <p className="text-xs text-rose-600 dark:text-rose-300">Sem etapas — o motor não instancia template vazio.</p> : null}
              </div>
              {t.descricao ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.descricao}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" disabled={!podeGerenciar || busy} onClick={() => setEditor(t)}>Editar</Button>
                <Button variant="secondary" disabled={!podeGerenciar || busy} onClick={() => void alternarAtivo(t)}>{t.active ? 'Desativar' : 'Ativar'}</Button>
                <Button variant="ghost" disabled={!podeGerenciar || busy} onClick={() => setExcluir(t)}>Excluir</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editor !== null && member ? (
        <TemplateEditorModal
          flowDef={def}
          template={editor === 'novo' ? null : editor}
          tenantId={member.tenant_id}
          onClose={(saved) => {
            setEditor(null);
            if (saved) void qc.invalidateQueries({ queryKey: ['wf-templates'] });
          }}
        />
      ) : null}
      <Modal open={excluir !== null} title="Excluir template?" onClose={() => setExcluir(null)}
        footer={<><Button variant="ghost" onClick={() => setExcluir(null)}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={() => void confirmarExclusao()}>{busy ? 'Excluindo…' : 'Excluir'}</Button></>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Instâncias já iniciadas não são afetadas (as etapas são um snapshot). Novos disparos deixam de usar este template.</p>
      </Modal>
    </div>
  );
}

type StepDraft = {
  nome: string; role_required: string; aprovador_especifico_id: string;
  sla_hours: number; instrucoes: string; actions: string[];
};

function novaEtapa(): StepDraft {
  return { nome: 'Gestor da Qualidade', role_required: 'gestor_qualidade', aprovador_especifico_id: '', sla_hours: 24, instrucoes: '', actions: [...WORKFLOW_ACTIONS] };
}

function TemplateEditorModal({ flowDef, template, tenantId, onClose }: { flowDef: FlowDef; template: WorkflowTemplate | null; tenantId: string; onClose: (saved: boolean) => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(template?.nome ?? `Fluxo — ${flowDef.label}`);
  const [descricao, setDescricao] = useState(template?.descricao ?? '');
  const [escopo, setEscopo] = useState<'lab' | 'cliente' | 'obra'>(template?.work_id ? 'obra' : template?.client_id ? 'cliente' : 'lab');
  const [clientId, setClientId] = useState(template?.client_id ?? '');
  const [workId, setWorkId] = useState(template?.work_id ?? '');
  const [ativo, setAtivo] = useState(template?.active ?? false);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    template && template.steps.length
      ? template.steps.map((s) => ({ nome: s.nome, role_required: s.role_required, aprovador_especifico_id: s.aprovador_especifico_id ?? '', sla_hours: s.sla_hours, instrucoes: s.instrucoes ?? '', actions: s.actions.length ? [...s.actions] : [...WORKFLOW_ACTIONS] }))
      : [novaEtapa()]);
  const clients = useQuery({ queryKey: ['wf-scope-clients'], queryFn: listClientsForScope, staleTime: 60_000 });
  const works = useQuery({ queryKey: ['wf-scope-works'], queryFn: listWorksForDelegation, staleTime: 60_000 });
  const members = useQuery({ queryKey: ['approval-delegations', 'members'], queryFn: listMembersForDelegation, staleTime: 60_000 });
  const papelRepetido = useMemo(() => new Set(steps.map((s) => s.role_required)).size < steps.length, [steps]);

  function patch(i: number, p: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }
  function mover(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  }
  function remover(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function toggleAcao(i: number, acao: string) {
    setSteps((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      const has = s.actions.includes(acao);
      if (has && acao === 'aprovar') return s; // aprovar é sempre permitido
      return { ...s, actions: has ? s.actions.filter((a) => a !== acao) : [...s.actions, acao] };
    }));
  }

  async function salvar() {
    if (!nome.trim()) { toast('Informe o nome do template.', 'error'); return; }
    if (!steps.length) { toast('Adicione ao menos uma etapa.', 'error'); return; }
    if (escopo === 'cliente' && !clientId) { toast('Selecione o cliente do escopo.', 'error'); return; }
    if (escopo === 'obra' && !workId) { toast('Selecione a obra do escopo.', 'error'); return; }
    setBusy(true);
    try {
      await saveWorkflowTemplate({
        id: template?.id ?? null, tenantId, flowKey: flowDef.key, nome, descricao,
        clientId: escopo === 'cliente' ? clientId : null, workId: escopo === 'obra' ? workId : null,
        active: ativo,
        steps: steps.map((s) => ({ nome: s.nome, role_required: s.role_required, aprovador_especifico_id: s.aprovador_especifico_id || null, sla_hours: s.sla_hours, obrigatoria: true, instrucoes: s.instrucoes || null, actions: s.actions })),
      });
      toast('Template salvo.', 'success');
      onClose(true);
    } catch (e) {
      const m = (e as Error).message;
      toast(m.includes('wf_templates_scope_unique') || m.includes('duplicate') ? 'Já existe um template ativo para este fluxo neste escopo. Salve como inativo ou desative o outro.' : m, 'error');
    } finally {
      setBusy(false);
    }
  }

  const memberRows = members.data ?? [];
  return (
    <Modal open title={template ? `Editar template — ${flowDef.label}` : `Novo template — ${flowDef.label}`} onClose={() => onClose(false)}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancelar</Button><Button disabled={busy} onClick={() => void salvar()}>{busy ? 'Salvando…' : 'Salvar template'}</Button></>}>
      <div className="space-y-4">
        <Field label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <TextArea label="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quando este fluxo se aplica" />
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField label="Escopo" value={escopo} onChange={(e) => setEscopo(e.target.value as 'lab' | 'cliente' | 'obra')}>
            <option value="lab">Padrão do laboratório</option>
            <option value="cliente">Cliente específico</option>
            <option value="obra">Obra específica</option>
          </SelectField>
          {escopo === 'cliente' ? (
            <SelectField label="Cliente" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Selecione</option>
              {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </SelectField>
          ) : escopo === 'obra' ? (
            <SelectField label="Obra" required value={workId} onChange={(e) => setWorkId(e.target.value)}>
              <option value="">Selecione</option>
              {(works.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </SelectField>
          ) : <div />}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Template ativo (usado pelos novos disparos deste escopo)
        </div>
        <div>
          <p className="kicker">Etapas (sequenciais)</p>
          {papelRepetido ? <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Atenção: o mesmo papel aparece em mais de uma etapa — a mesma pessoa pode decidir etapas seguidas.</p> : null}
        </div>

        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={`etapa-${i}-${s.role_required}`} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Etapa {i + 1}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" onClick={() => mover(i, -1)} disabled={i === 0}>↑</Button>
                  <Button variant="ghost" onClick={() => mover(i, 1)} disabled={i === steps.length - 1}>↓</Button>
                  <Button variant="ghost" onClick={() => remover(i)} disabled={steps.length === 1}>Remover</Button>
                </div>
              </div>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <Field label="Nome da etapa" required value={s.nome} onChange={(e) => patch(i, { nome: e.target.value })} />
                <SelectField label="Papel aprovador" required value={s.role_required} onChange={(e) => patch(i, { role_required: e.target.value })}>
                  {WORKFLOW_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </SelectField>
                <SelectField label="Aprovador específico (opcional)" value={s.aprovador_especifico_id} onChange={(e) => patch(i, { aprovador_especifico_id: e.target.value })}>
                  <option value="">Qualquer um com o papel</option>
                  {memberRows.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.role}</option>)}
                </SelectField>
                <Field label="SLA (horas)" type="number" value={String(s.sla_hours)} onChange={(e) => patch(i, { sla_hours: Number(e.target.value) || 24 })} />
                <div className="md:col-span-2"><TextArea label="Instruções ao aprovador (opcional)" value={s.instrucoes} onChange={(e) => patch(i, { instrucoes: e.target.value })} /></div>
                <div className="flex flex-wrap items-center gap-4 text-sm font-semibold md:col-span-2">
                  Ações permitidas:
                  {WORKFLOW_ACTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-1 font-normal">
                      <input type="checkbox" checked={s.actions.includes(a)} disabled={a === 'aprovar'} onChange={() => toggleAcao(i, a)} /> {a}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setSteps((prev) => [...prev, novaEtapa()])}>+ Adicionar etapa</Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">E-mails de pendência cobrem os papéis administrador, gestor da qualidade, laboratorista e financeiro. Operador de campo decide pelo sistema, sem e-mail (Leva W5).</p>
      </div>
    </Modal>
  );
}

function GatilhoRow({ gatilho, def, podeGerenciar, onSaved }: { gatilho: WorkflowGatilho; def: FlowDef; podeGerenciar: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [tol, setTol] = useState<string>(() => String((gatilho.params.tolerancia_pct as number | undefined) ?? 0));

  async function alternar() {
    setBusy(true);
    try {
      await saveWorkflowGatilho(gatilho.id, !gatilho.enabled, gatilho.params);
      toast(gatilho.enabled ? `${def.label}: gatilho desligado.` : `${def.label}: gatilho ligado.`, 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function salvarParams() {
    setBusy(true);
    try {
      await saveWorkflowGatilho(gatilho.id, gatilho.enabled, { ...gatilho.params, tolerancia_pct: Math.max(0, Number(tol) || 0) });
      toast('Parâmetros salvos.', 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{def.label}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{def.hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${gatilho.enabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{gatilho.enabled ? 'ligado' : 'desligado'}</span>
          <Button variant={gatilho.enabled ? 'secondary' : 'primary'} disabled={!podeGerenciar || busy} onClick={() => void alternar()}>{gatilho.enabled ? 'Desligar' : 'Ligar'}</Button>
        </div>
      </div>
      {def.key === 'laudo_inconsistente' ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-40"><Field label="Tolerância (%)" type="number" value={tol} onChange={(e) => setTol(e.target.value)} /></div>
          <Button variant="secondary" disabled={!podeGerenciar || busy} onClick={() => void salvarParams()}>Salvar parâmetro</Button>
          <p className="text-xs text-slate-500 dark:text-slate-400">0 = estrito: qualquer CP de idade menor acima do de idade maior dispara.</p>
        </div>
      ) : null}
    </div>
  );
}

function GatilhosTab() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['wf-gatilhos'], queryFn: listWorkflowGatilhos, staleTime: 30_000 });
  const podeGerenciar = can('workflow.gerenciar');
  const porFluxo = useMemo(() => new Map((q.data ?? []).map((g) => [g.flow_key, g])), [q.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader kicker="Gatilhos" title="Ligar e desligar fluxos por laboratório">Gatilho ligado + template ativo = fluxo operante: instâncias podem ser iniciadas e decididas em Minhas aprovações. Os bloqueios automáticos do domínio (emissão de laudo, envio de medição, descarte) entram nas Levas W3–W5 — até lá, nada é travado.</CardHeader>
        <div className="space-y-3 p-5">
          {q.isLoading ? <LoadingState /> : q.error ? <ErrorState message={(q.error as Error).message} /> : (
            FLOW_CATALOG.map((def) => {
              const g = porFluxo.get(def.key);
              if (!g) return null;
              return <GatilhoRow key={def.key} gatilho={g} def={def} podeGerenciar={podeGerenciar} onSaved={() => void qc.invalidateQueries({ queryKey: ['wf-gatilhos'] })} />;
            })
          )}
        </div>
      </Card>
    </div>
  );
}
