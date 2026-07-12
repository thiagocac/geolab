import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, SelectField } from '../../components/ui/Field';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { finishOnboarding, getOnboardingSnapshot, setOnboardingStep, type OnboardingStep } from '../../lib/api/onboarding';
import { getConfigLab, logoSignedUrl, saveConfigLab, uploadLogo } from '../../lib/api/preferencias';
import { FUNCOES, listColaboradoresRef, saveColaborador } from '../../lib/api/colaboradores';
import { createObra, createTracoObra } from '../../lib/api/obras';
import { TIPOS_EQUIP, listEquipamentosRef, rotuloEquip, saveEquipamento } from '../../lib/api/equipamentos';
import { createClienteUsuario, listClienteUsuarios, listClientesPortal, listObrasPortal } from '../../lib/api/clientUsers';
import { consultaFiscal } from '../../lib/api/fiscal';
import { createCliente, listCatalogoResumo, listTestTypesAtivos } from '../../lib/api/implantacao';
import { Pill } from '../gestao/product/ProductUi';

// [v238] Implantação self-service: wizard sobre a MESMA máquina do onboarding
// (lab_onboarding_runs/steps + auto-detecção via get_onboarding_snapshot). Os formulários
// embutidos são enxutos — gravam pelas APIs de domínio; o cadastro completo segue nas telas
// normais (link "Abrir tela completa" em cada etapa). O gate de primeira entrada vive no Layout.

function tone(status: OnboardingStep['status']) { return status === 'concluido' ? 'good' as const : status === 'ignorado' ? 'neutral' as const : 'warn' as const; }
const rotuloStatus: Record<OnboardingStep['status'], string> = { pendente: 'pendente', concluido: 'concluída', ignorado: 'ignorada' };

function Chips({ itens, vazio }: { itens: string[]; vazio: string }) {
  if (!itens.length) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {itens.slice(0, 12).map((t, i) => <span key={i} className="rounded-full border px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200" style={{ borderColor: 'var(--line)' }}>{t}</span>)}
      {itens.length > 12 ? <span className="self-center text-xs text-slate-500">+{itens.length - 12}</span> : null}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
      <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">{titulo}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export function ImplantacaoPage() {
  const { member, can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const tenantId = member?.tenant_id ?? '';
  const snapQ = useQuery({ queryKey: ['lab-onboarding', tenantId], enabled: !!member, queryFn: getOnboardingSnapshot });
  const steps = snapQ.data?.steps ?? [];
  const run = snapQ.data?.run;
  const [ativoKey, setAtivoKey] = useState<string | null>(null);
  useEffect(() => {
    if (!ativoKey && steps.length) setAtivoKey((steps.find((s) => s.status === 'pendente') ?? steps[0]).key);
  }, [ativoKey, steps]);
  const ativo = steps.find((s) => s.key === ativoKey) ?? steps[0];
  const idx = ativo ? steps.findIndex((s) => s.key === ativo.key) : 0;
  const gerencia = can('onboarding.gerenciar');
  const pendReq = steps.filter((s) => s.required && s.status === 'pendente').length;
  const [busy, setBusy] = useState(false);

  async function refresh() { await qc.invalidateQueries({ queryKey: ['lab-onboarding'] }); }
  async function marcar(step: OnboardingStep, status: OnboardingStep['status']) {
    setBusy(true);
    try { await setOnboardingStep(step.key, status); await refresh(); toast('Etapa atualizada.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  }
  async function concluir() {
    setBusy(true);
    try { await finishOnboarding(); await refresh(); toast('Implantação concluída. Bom trabalho!', 'success'); nav('/'); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">Configuração inicial</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Implantação do laboratório</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Complete as etapas abaixo para deixar o laboratório pronto para operar. Tudo pode ser ajustado depois nas telas normais.</p>
        </div>
        <Button variant="secondary" onClick={() => nav('/')}>Ir para o sistema</Button>
      </div>
      {snapQ.isLoading ? <LoadingState /> : snapQ.error ? <ErrorState message={(snapQ.error as Error).message} /> : !steps.length || !ativo ? <ErrorState message="Onboarding indisponível." /> : <>
        <Card className="overflow-hidden">
          <div className="p-5" style={{ background: 'var(--grad-brand)', color: '#fff' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold">{snapQ.data!.progress}% concluído{pendReq > 0 ? ` · ${pendReq} etapa${pendReq > 1 ? 's' : ''} obrigatória${pendReq > 1 ? 's' : ''} pendente${pendReq > 1 ? 's' : ''}` : ' · nenhuma obrigatória pendente'}</p>
              {gerencia && pendReq === 0 && run?.status !== 'concluido' ? <Button className="bg-white !text-slate-900" disabled={busy} onClick={() => void concluir()}>Concluir implantação</Button> : null}
              {run?.status === 'concluido' ? <span className="text-sm font-bold opacity-90">Implantação concluída</span> : null}
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, Math.max(0, snapQ.data!.progress))}%` }} /></div>
          </div>
        </Card>
        <div className="flex flex-wrap gap-2">
          {steps.map((s) => (
            <button key={s.key} type="button" onClick={() => setAtivoKey(s.key)}
              className={'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ' + (s.key === ativo.key ? 'text-white' : 'text-slate-700 dark:text-slate-200')}
              style={s.key === ativo.key ? { background: 'var(--navy)', borderColor: 'var(--navy)' } : { borderColor: 'var(--line)' }}>
              <span className={'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ' + (s.status === 'concluido' ? 'bg-emerald-500 text-white' : s.status === 'ignorado' ? 'bg-slate-400 text-white' : s.key === ativo.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200')}>{s.status === 'concluido' ? '✓' : s.position}</span>
              {s.title}
            </button>
          ))}
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="kicker">Etapa {ativo.position} de {steps.length}{ativo.required ? ' · obrigatória' : ' · recomendada'}</p>
              <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{ativo.title}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ativo.description}</p>
            </div>
            <Pill tone={tone(ativo.status)}>{rotuloStatus[ativo.status]}</Pill>
          </div>
          <div className="mt-5">
            <StepBody step={ativo} tenantId={tenantId} gerencia={gerencia} onMudou={() => void refresh()} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
            <Button variant="secondary" disabled={idx <= 0} onClick={() => setAtivoKey(steps[idx - 1]?.key ?? ativo.key)}>Anterior</Button>
            <Button disabled={idx >= steps.length - 1} onClick={() => setAtivoKey(steps[idx + 1]?.key ?? ativo.key)}>Próxima</Button>
            <span className="flex-1" />
            {ativo.route ? <Button variant="ghost" onClick={() => nav(ativo.route!)}>Abrir tela completa</Button> : null}
            {gerencia && ativo.status === 'pendente' ? <Button variant="ghost" disabled={busy} onClick={() => void marcar(ativo, 'concluido')}>Marcar concluída</Button> : null}
            {gerencia && ativo.status === 'pendente' && !ativo.required ? <Button variant="ghost" disabled={busy} onClick={() => void marcar(ativo, 'ignorado')}>Ignorar</Button> : null}
            {gerencia && ativo.status !== 'pendente' ? <Button variant="ghost" disabled={busy} onClick={() => void marcar(ativo, 'pendente')}>Reabrir</Button> : null}
          </div>
        </Card>
      </>}
    </div>
  );
}

function StepBody({ step, tenantId, gerencia, onMudou }: { step: OnboardingStep; tenantId: string; gerencia: boolean; onMudou: () => void }) {
  if (!gerencia) return <p className="text-sm text-slate-500">Somente perfis com permissão de gerenciar o onboarding editam por aqui.</p>;
  switch (step.key) {
    case 'laboratorio': return <StepLaboratorio tenantId={tenantId} onMudou={onMudou} />;
    case 'acessos': return <StepEquipe tenantId={tenantId} onMudou={onMudou} />;
    case 'clientes_obras': return <StepClienteObra tenantId={tenantId} onMudou={onMudou} />;
    case 'equipamentos': return <StepEquipamentos tenantId={tenantId} onMudou={onMudou} />;
    case 'ensaios': return <StepEnsaios tenantId={tenantId} onMudou={onMudou} />;
    case 'catalogo': return <StepCatalogo />;
    case 'laudo_assinatura': return <StepLaudo tenantId={tenantId} onMudou={onMudou} />;
    case 'portal_cliente': return <StepPortal tenantId={tenantId} onMudou={onMudou} />;
    default: return <p className="text-sm text-slate-500">Use o botão &quot;Abrir tela completa&quot; para resolver esta etapa.</p>;
  }
}

type StepProps = { tenantId: string; onMudou: () => void };

function StepLaboratorio({ tenantId, onMudou }: StepProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const cfgQ = useQuery({ queryKey: ['implantacao-config', tenantId], enabled: !!tenantId, queryFn: () => getConfigLab(tenantId) });
  const [v, setV] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  useEffect(() => {
    const c = cfgQ.data;
    if (!c) return;
    setV({ responsavel_tecnico: c.responsavel_tecnico ?? '', crea_rt: c.crea_rt ?? '', cep: c.cep ?? '', endereco: c.endereco ?? '', numero: c.numero ?? '', bairro: c.bairro ?? '', cidade: c.cidade ?? '', uf: c.uf ?? '' });
  }, [cfgQ.data]);
  const set = (k: string) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  async function buscarCep() {
    if (!v.cep?.trim()) return;
    setBuscandoCep(true);
    try {
      const d = await consultaFiscal('cep', v.cep.trim());
      setV((s) => ({ ...s, endereco: String(d.endereco ?? d.logradouro ?? s.endereco ?? ''), bairro: String(d.bairro ?? s.bairro ?? ''), cidade: String(d.cidade ?? s.cidade ?? ''), uf: String(d.uf ?? s.uf ?? '') }));
      toast('Endereço preenchido pelo CEP.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBuscandoCep(false); }
  }
  async function salvar() {
    if (!v.responsavel_tecnico?.trim()) { toast('Informe o responsável técnico.', 'error'); return; }
    setSalvando(true);
    try {
      await saveConfigLab(tenantId, { responsavel_tecnico: v.responsavel_tecnico.trim(), crea_rt: v.crea_rt?.trim() || null, cep: v.cep?.trim() || null, endereco: v.endereco?.trim() || null, numero: v.numero?.trim() || null, bairro: v.bairro?.trim() || null, cidade: v.cidade?.trim() || null, uf: v.uf?.trim() || null });
      await qc.invalidateQueries({ queryKey: ['implantacao-config'] });
      onMudou();
      toast('Identidade do laboratório salva.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvando(false); }
  }
  if (cfgQ.isLoading) return <LoadingState />;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Responsável técnico" required value={v.responsavel_tecnico ?? ''} onChange={set('responsavel_tecnico')} placeholder="Nome do RT" />
        <Field label="CREA do RT" value={v.crea_rt ?? ''} onChange={set('crea_rt')} placeholder="UF-000000/D" />
      </div>
      <div className="grid gap-3 md:grid-cols-[160px_1fr_110px]">
        <Field label="CEP" value={v.cep ?? ''} onChange={set('cep')} placeholder="00000-000" />
        <Field label="Endereço" value={v.endereco ?? ''} onChange={set('endereco')} />
        <div className="flex items-end"><Button variant="secondary" disabled={buscandoCep} onClick={() => void buscarCep()}>{buscandoCep ? 'Buscando…' : 'Buscar CEP'}</Button></div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Número" value={v.numero ?? ''} onChange={set('numero')} />
        <Field label="Bairro" value={v.bairro ?? ''} onChange={set('bairro')} />
        <Field label="Cidade" value={v.cidade ?? ''} onChange={set('cidade')} />
        <Field label="UF" value={v.uf ?? ''} onChange={set('uf')} maxLength={2} placeholder="SP" />
      </div>
      <Button disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar identidade'}</Button>
    </div>
  );
}

function StepEquipe({ tenantId, onMudou }: StepProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const listQ = useQuery({ queryKey: ['colaboradores-ref'], queryFn: listColaboradoresRef });
  const [nome, setNome] = useState('');
  const [registro, setRegistro] = useState('');
  const [funcoes, setFuncoes] = useState<string[]>(['Moldador']);
  const [salvando, setSalvando] = useState(false);
  function toggleFuncao(f: string) { setFuncoes((s) => s.includes(f) ? s.filter((x) => x !== f) : [...s, f]); }
  async function adicionar() {
    if (!nome.trim()) { toast('Informe o nome do colaborador.', 'error'); return; }
    setSalvando(true);
    try {
      await saveColaborador(tenantId, null, { nome: nome.trim(), registro_profissional: registro.trim() || null, funcoes, ativo: true });
      setNome(''); setRegistro('');
      await qc.invalidateQueries({ queryKey: ['colaboradores-ref'] });
      onMudou();
      toast('Colaborador adicionado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvando(false); }
  }
  const ativos = (listQ.data ?? []).filter((c) => c.ativo);
  return (
    <div className="space-y-4">
      <Bloco titulo="Colaboradores do laboratório">
        <Chips itens={ativos.map((c) => c.nome + (c.funcoes.length ? ` (${c.funcoes.join(', ')})` : ''))} vazio="Nenhum colaborador cadastrado ainda." />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          <Field label="Registro profissional" value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="CREA/CFT (opcional)" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Funções</p>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {FUNCOES.map((f) => (
              <label key={f} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={funcoes.includes(f)} onChange={() => toggleFuncao(f)} /> {f}
              </label>
            ))}
          </div>
        </div>
        <Button disabled={salvando} onClick={() => void adicionar()}>{salvando ? 'Adicionando…' : 'Adicionar colaborador'}</Button>
      </Bloco>
      <p className="text-sm text-slate-500">Usuários com login (e-mail e senha) e convites ficam em Operação → Usuários. <Button variant="ghost" onClick={() => nav('/operacao')}>Abrir usuários</Button></p>
    </div>
  );
}

function StepClienteObra({ tenantId, onMudou }: StepProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const clientesQ = useQuery({ queryKey: ['implantacao-clientes'], queryFn: listClientesPortal });
  const obrasQ = useQuery({ queryKey: ['implantacao-obras'], queryFn: () => listObrasPortal() });
  const [cli, setCli] = useState({ razao_social: '', cnpj_cpf: '', email: '', telefone: '' });
  const [obra, setObra] = useState({ client_id: '', nome: '', cidade: '', uf: '' });
  const [salvandoCli, setSalvandoCli] = useState(false);
  const [salvandoObra, setSalvandoObra] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  async function buscarCnpj() {
    if (!cli.cnpj_cpf.trim()) return;
    setBuscandoCnpj(true);
    try {
      const d = await consultaFiscal('cnpj', cli.cnpj_cpf.trim());
      setCli((s) => ({ ...s, razao_social: String(d.razao_social ?? s.razao_social ?? ''), email: String(d.email ?? s.email ?? ''), telefone: String(d.telefone ?? s.telefone ?? '') }));
      toast('Dados preenchidos pelo CNPJ.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBuscandoCnpj(false); }
  }
  async function addCliente() {
    if (!cli.razao_social.trim()) { toast('Informe a razão social do cliente.', 'error'); return; }
    setSalvandoCli(true);
    try {
      const id = await createCliente(tenantId, { razao_social: cli.razao_social.trim(), cnpj_cpf: cli.cnpj_cpf.trim() || null, email: cli.email.trim() || null, telefone: cli.telefone.trim() || null });
      setCli({ razao_social: '', cnpj_cpf: '', email: '', telefone: '' });
      setObra((s) => ({ ...s, client_id: id }));
      await qc.invalidateQueries({ queryKey: ['implantacao-clientes'] });
      onMudou();
      toast('Cliente cadastrado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvandoCli(false); }
  }
  async function addObra() {
    if (!obra.client_id) { toast('Selecione o cliente da obra.', 'error'); return; }
    if (!obra.nome.trim()) { toast('Informe o nome da obra.', 'error'); return; }
    setSalvandoObra(true);
    try {
      await createObra(tenantId, { client_id: obra.client_id, nome: obra.nome.trim(), cidade: obra.cidade.trim() || null, uf: obra.uf.trim() || null });
      setObra({ client_id: obra.client_id, nome: '', cidade: '', uf: '' });
      await qc.invalidateQueries({ queryKey: ['implantacao-obras'] });
      onMudou();
      toast('Obra cadastrada.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvandoObra(false); }
  }

  return (
    <div className="space-y-4">
      <Bloco titulo="Clientes (construtoras)">
        <Chips itens={(clientesQ.data ?? []).map((c) => c.nome)} vazio="Nenhum cliente cadastrado ainda." />
        <div className="grid gap-3 md:grid-cols-[1fr_150px_110px]">
          <Field label="Razão social" required value={cli.razao_social} onChange={(e) => setCli((s) => ({ ...s, razao_social: e.target.value }))} />
          <Field label="CNPJ/CPF" value={cli.cnpj_cpf} onChange={(e) => setCli((s) => ({ ...s, cnpj_cpf: e.target.value }))} placeholder="Opcional" />
          <div className="flex items-end"><Button variant="secondary" disabled={buscandoCnpj} onClick={() => void buscarCnpj()}>{buscandoCnpj ? 'Buscando…' : 'Buscar CNPJ'}</Button></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="E-mail" type="email" value={cli.email} onChange={(e) => setCli((s) => ({ ...s, email: e.target.value }))} />
          <Field label="Telefone" value={cli.telefone} onChange={(e) => setCli((s) => ({ ...s, telefone: e.target.value }))} />
        </div>
        <Button disabled={salvandoCli} onClick={() => void addCliente()}>{salvandoCli ? 'Salvando…' : 'Adicionar cliente'}</Button>
      </Bloco>
      <Bloco titulo="Obras">
        <Chips itens={(obrasQ.data ?? []).map((o) => o.nome + (o.cliente ? ` · ${o.cliente}` : ''))} vazio="Nenhuma obra cadastrada ainda." />
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField label="Cliente" required value={obra.client_id} onChange={(e) => setObra((s) => ({ ...s, client_id: e.target.value }))}>
            <option value="">Selecione…</option>
            {(clientesQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </SelectField>
          <Field label="Nome da obra" required value={obra.nome} onChange={(e) => setObra((s) => ({ ...s, nome: e.target.value }))} />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_120px]">
          <Field label="Cidade" value={obra.cidade} onChange={(e) => setObra((s) => ({ ...s, cidade: e.target.value }))} />
          <Field label="UF" value={obra.uf} onChange={(e) => setObra((s) => ({ ...s, uf: e.target.value }))} maxLength={2} />
        </div>
        <Button disabled={salvandoObra} onClick={() => void addObra()}>{salvandoObra ? 'Salvando…' : 'Adicionar obra'}</Button>
      </Bloco>
    </div>
  );
}

function StepEquipamentos({ tenantId, onMudou }: StepProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ['equipamentos-ref'], queryFn: listEquipamentosRef });
  const [v, setV] = useState({ tipo: 'prensa', apelido: '', marca_modelo: '', capacidade_kn: '', unidade_carga: 'kn', data_calibracao: '', validade_calibracao: '' });
  const [salvando, setSalvando] = useState(false);
  const prensa = v.tipo === 'prensa';
  async function adicionar() {
    if (!v.apelido.trim() && !v.marca_modelo.trim()) { toast('Informe pelo menos apelido ou marca/modelo.', 'error'); return; }
    setSalvando(true);
    try {
      await saveEquipamento(tenantId, null, {
        tipo: v.tipo, apelido: v.apelido.trim() || null, marca_modelo: v.marca_modelo.trim() || null,
        capacidade_kn: prensa && v.capacidade_kn ? Number(v.capacidade_kn) : null,
        unidade_carga: prensa ? v.unidade_carga : null,
        data_calibracao: v.data_calibracao || null, validade_calibracao: v.validade_calibracao || null, ativo: true,
      });
      setV({ tipo: v.tipo, apelido: '', marca_modelo: '', capacidade_kn: '', unidade_carga: v.unidade_carga, data_calibracao: '', validade_calibracao: '' });
      await qc.invalidateQueries({ queryKey: ['equipamentos-ref'] });
      onMudou();
      toast('Equipamento adicionado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvando(false); }
  }
  const ativos = (listQ.data ?? []).filter((e) => e.ativo);
  return (
    <div className="space-y-4">
      <Bloco titulo="Equipamentos cadastrados">
        <Chips itens={ativos.map((e) => rotuloEquip(e) + ` (${e.tipo})`)} vazio="Nenhum equipamento cadastrado ainda. Comece pela prensa." />
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Tipo" required value={v.tipo} onChange={(e) => setV((s) => ({ ...s, tipo: e.target.value }))}>
            {TIPOS_EQUIP.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </SelectField>
          <Field label="Apelido" value={v.apelido} onChange={(e) => setV((s) => ({ ...s, apelido: e.target.value }))} placeholder="Prensa 1" />
          <Field label="Marca/modelo" value={v.marca_modelo} onChange={(e) => setV((s) => ({ ...s, marca_modelo: e.target.value }))} />
        </div>
        {prensa ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Capacidade (kN)" type="number" value={v.capacidade_kn} onChange={(e) => setV((s) => ({ ...s, capacidade_kn: e.target.value }))} placeholder="2000" />
            <SelectField label="Unidade de carga do display" value={v.unidade_carga} onChange={(e) => setV((s) => ({ ...s, unidade_carga: e.target.value }))} hint="Como a prensa exibe a carga no rompimento.">
              <option value="kn">kN</option><option value="tf">tf</option><option value="kgf">kgf</option>
            </SelectField>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Data da calibração" type="date" value={v.data_calibracao} onChange={(e) => setV((s) => ({ ...s, data_calibracao: e.target.value }))} />
          <Field label="Validade da calibração" type="date" value={v.validade_calibracao} onChange={(e) => setV((s) => ({ ...s, validade_calibracao: e.target.value }))} hint="Alimenta o alerta de calibração vencendo." />
        </div>
        <Button disabled={salvando} onClick={() => void adicionar()}>{salvando ? 'Adicionando…' : 'Adicionar equipamento'}</Button>
      </Bloco>
    </div>
  );
}

function StepEnsaios({ tenantId, onMudou }: StepProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const tiposQ = useQuery({ queryKey: ['implantacao-ensaios'], queryFn: listTestTypesAtivos });
  const obrasQ = useQuery({ queryKey: ['implantacao-obras'], queryFn: () => listObrasPortal() });
  const [t, setT] = useState({ work_id: '', codigo: '', fck: '', idade: '28' });
  const [salvando, setSalvando] = useState(false);
  async function addTraco() {
    if (!t.work_id) { toast('Selecione a obra do traço.', 'error'); return; }
    if (!t.codigo.trim()) { toast('Informe o código do traço (ex.: FCK30-B1).', 'error'); return; }
    if (!t.fck || Number(t.fck) <= 0) { toast('Informe o FCK em MPa.', 'error'); return; }
    setSalvando(true);
    try {
      await createTracoObra(tenantId, t.work_id, { codigo: t.codigo.trim(), nome: t.codigo.trim(), fck_mpa: Number(t.fck), idade_controle_dias: Number(t.idade) || 28, ativo: true });
      setT({ work_id: t.work_id, codigo: '', fck: '', idade: t.idade });
      await qc.invalidateQueries({ queryKey: ['implantacao-obras'] });
      onMudou();
      toast('Traço cadastrado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvando(false); }
  }
  return (
    <div className="space-y-4">
      <Bloco titulo="Tipos de ensaio ativos">
        {tiposQ.isLoading ? <LoadingState /> : <Chips itens={(tiposQ.data ?? []).map((x) => `${x.nome} · controle ${x.idade}`)} vazio="Nenhum tipo de ensaio ativo." />}
        <p className="text-sm text-slate-500">Na v1 o fluxo completo é concreto — compressão (NBR 5739). Idades e padrão de moldagem são ajustados por traço.</p>
      </Bloco>
      <Bloco titulo="Primeiro traço (opcional aqui, obrigatório para programar)">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField label="Obra" required value={t.work_id} onChange={(e) => setT((s) => ({ ...s, work_id: e.target.value }))}>
            <option value="">Selecione…</option>
            {(obrasQ.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}{o.cliente ? ` · ${o.cliente}` : ''}</option>)}
          </SelectField>
          <Field label="Código do traço" required value={t.codigo} onChange={(e) => setT((s) => ({ ...s, codigo: e.target.value }))} placeholder="FCK30-B1" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="FCK (MPa)" required type="number" value={t.fck} onChange={(e) => setT((s) => ({ ...s, fck: e.target.value }))} placeholder="30" />
          <Field label="Idade de controle (dias)" type="number" value={t.idade} onChange={(e) => setT((s) => ({ ...s, idade: e.target.value }))} hint="Única idade de aceitação (default 28d); as demais são acompanhamento." />
        </div>
        <Button disabled={salvando} onClick={() => void addTraco()}>{salvando ? 'Salvando…' : 'Adicionar traço'}</Button>
      </Bloco>
    </div>
  );
}

function StepCatalogo() {
  const nav = useNavigate();
  const catQ = useQuery({ queryKey: ['implantacao-catalogo'], queryFn: listCatalogoResumo });
  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return (
    <div className="space-y-3">
      {catQ.isLoading ? <LoadingState /> : <Chips itens={(catQ.data ?? []).map((i) => `${i.code} ${i.nome} · ${fmt(i.preco)}`)} vazio="Catálogo vazio — cadastre os serviços cobrados pelo laboratório." />}
      <p className="text-sm text-slate-500">Revise nomes, unidades e preços sugeridos — eles alimentam propostas e medições. Depois marque a etapa como concluída.</p>
      <Button variant="secondary" onClick={() => nav('/financeiro')}>Abrir catálogo no Financeiro</Button>
    </div>
  );
}

function StepLaudo({ tenantId, onMudou }: StepProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const cfgQ = useQuery({ queryKey: ['implantacao-config', tenantId], enabled: !!tenantId, queryFn: () => getConfigLab(tenantId) });
  const [v, setV] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  useEffect(() => {
    const c = cfgQ.data;
    if (!c) return;
    setV({ responsavel_tecnico: c.responsavel_tecnico ?? '', crea_rt: c.crea_rt ?? '', art_numero: c.art_numero ?? '', local_ensaio: c.local_ensaio ?? '' });
    if (c.logo_path) { void logoSignedUrl(c.logo_path).then(setLogoUrl); } else { setLogoUrl(null); }
  }, [cfgQ.data]);
  const set = (k: string) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  async function onLogo(file: File | null) {
    if (!file) return;
    setSubindo(true);
    try {
      const path = await uploadLogo(tenantId, file);
      await saveConfigLab(tenantId, { logo_path: path });
      await qc.invalidateQueries({ queryKey: ['implantacao-config'] });
      onMudou();
      toast('Logo enviada.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSubindo(false); }
  }
  async function salvar() {
    if (!v.responsavel_tecnico?.trim()) { toast('Informe o responsável técnico.', 'error'); return; }
    setSalvando(true);
    try {
      await saveConfigLab(tenantId, { responsavel_tecnico: v.responsavel_tecnico.trim(), crea_rt: v.crea_rt?.trim() || null, art_numero: v.art_numero?.trim() || null, local_ensaio: v.local_ensaio?.trim() || null });
      await qc.invalidateQueries({ queryKey: ['implantacao-config'] });
      onMudou();
      toast('Dados do laudo salvos.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvando(false); }
  }
  if (cfgQ.isLoading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <Bloco titulo="Logo do laboratório no laudo">
        <div className="flex flex-wrap items-center gap-4">
          {logoUrl ? <img src={logoUrl} alt="Logo do laboratório" className="h-14 w-auto rounded border bg-white p-1" style={{ borderColor: 'var(--line)' }} /> : <p className="text-sm text-slate-500">Sem logo — o laudo sai só com texto.</p>}
          <label className="block">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Enviar logo (PNG/JPG)</span>
            <input type="file" accept="image/png,image/jpeg" className="input mt-1" disabled={subindo} onChange={(e) => void onLogo(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </Bloco>
      <Bloco titulo="Responsável técnico e ART">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Responsável técnico" required value={v.responsavel_tecnico ?? ''} onChange={set('responsavel_tecnico')} />
          <Field label="CREA do RT" value={v.crea_rt ?? ''} onChange={set('crea_rt')} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Número da ART" value={v.art_numero ?? ''} onChange={set('art_numero')} />
          <Field label="Local de ensaio" value={v.local_ensaio ?? ''} onChange={set('local_ensaio')} placeholder="Laboratório — unidade sede" />
        </div>
        <Button disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar dados do laudo'}</Button>
      </Bloco>
      <p className="text-sm text-slate-500">
        Campos exibidos no laudo e assinatura digital ficam em Configurações.
        <Button variant="ghost" onClick={() => nav('/gestao/config-campos')}>Campos do laudo</Button>
        <Button variant="ghost" onClick={() => nav('/configuracoes?tab=assinatura')}>Assinatura</Button>
      </p>
    </div>
  );
}

function StepPortal({ tenantId, onMudou }: StepProps) {
  const toast = useToast();
  const qc = useQueryClient();
  void tenantId;
  const usersQ = useQuery({ queryKey: ['implantacao-portal-users'], queryFn: listClienteUsuarios });
  const obrasQ = useQuery({ queryKey: ['implantacao-obras'], queryFn: () => listObrasPortal() });
  const [v, setV] = useState({ nome: '', email: '' });
  const [obras, setObras] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [acesso, setAcesso] = useState<{ email: string; senha: string } | null>(null);
  function toggleObra(id: string) { setObras((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); }
  async function criar() {
    if (!v.nome.trim()) { toast('Informe o nome do usuário do cliente.', 'error'); return; }
    if (!v.email.trim()) { toast('Informe o e-mail de acesso.', 'error'); return; }
    if (!obras.length) { toast('Selecione ao menos uma obra.', 'error'); return; }
    setSalvando(true);
    try {
      const r = await createClienteUsuario({ nome: v.nome.trim(), email: v.email.trim(), work_ids: obras });
      setAcesso({ email: r.username, senha: r.temp_password });
      setV({ nome: '', email: '' }); setObras([]);
      await qc.invalidateQueries({ queryKey: ['implantacao-portal-users'] });
      onMudou();
      toast('Acesso ao portal criado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSalvando(false); }
  }
  const ativos = (usersQ.data ?? []).filter((u) => u.active);
  return (
    <div className="space-y-4">
      <Bloco titulo="Usuários de clientes no portal">
        <Chips itens={ativos.map((u) => (u.full_name || u.email) + (u.obras.length ? ` (${u.obras.length} obra${u.obras.length > 1 ? 's' : ''})` : ''))} vazio="Nenhum usuário de cliente ainda. Esta etapa é recomendada — dá ao cliente acesso aos resultados." />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome" required value={v.nome} onChange={(e) => setV((s) => ({ ...s, nome: e.target.value }))} placeholder="Contato da construtora" />
          <Field label="E-mail de acesso" required type="email" value={v.email} onChange={(e) => setV((s) => ({ ...s, email: e.target.value }))} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Obras visíveis no portal<span className="ml-0.5 font-bold" style={{ color: 'var(--magenta)' }}>*</span></p>
          <div className="mt-1.5 flex max-h-40 flex-col gap-1.5 overflow-y-auto">
            {(obrasQ.data ?? []).map((o) => (
              <label key={o.id} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={obras.includes(o.id)} onChange={() => toggleObra(o.id)} /> {o.nome}{o.cliente ? <span className="text-slate-500"> · {o.cliente}</span> : null}
              </label>
            ))}
            {!obrasQ.data?.length ? <p className="text-sm text-slate-500">Cadastre uma obra na etapa 3 antes.</p> : null}
          </div>
        </div>
        <Button disabled={salvando} onClick={() => void criar()}>{salvando ? 'Criando…' : 'Criar acesso ao portal'}</Button>
        {acesso ? (
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--magenta)' }}>
            <p className="font-bold text-slate-950 dark:text-white">Acesso criado — anote e envie ao cliente (a senha não é exibida de novo):</p>
            <p className="mt-1">Login: <strong>{acesso.email}</strong> · Senha temporária: <strong>{acesso.senha}</strong></p>
          </div>
        ) : null}
      </Bloco>
    </div>
  );
}
