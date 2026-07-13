import { useEffect, useMemo, useState, type ClipboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { sanitizeDecimal, clampNum } from '../../lib/validacao';
import { FilePicker } from '../../components/ui/FilePicker';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { filtrarPorFuncao, getColaboradorEquipamentosByMember, listColaboradoresRef } from '../../lib/api/colaboradores';
import { cpPorQr, cpPorNumeracao, type CpQr } from '../../lib/api/etiquetas';
import { listEquipamentosRef, mapAlocacaoObras, rotuloEquip } from '../../lib/api/equipamentos';
import { getConfigLab } from '../../lib/api/preferencias';
import { dispersaoPct } from '../../lib/api/dispersao';
import { CAMPOS_ENSAIO, initCampoState } from '../../lib/concreto/camposEnsaioLaudo';
import { DIMENSOES_CP, cargaParaMpa, relacaoHD, type UnidadeCarga } from '../../lib/concreto/cp';
import {
  gerarAgendaPdf,
  gerarContraprova,
  lancarRompimentoCp,
  lancarRompimentosLote,
  lancarSituacaoCp,
  listCpsRompimento,
  ROMP_CAP,
  notifyAbaixoFck,
  resultadoAtual,
  ocrAgendaRompimento,
  resumoRompimentos,
  setNumeracaoCp,
  type CpRompimento,
} from '../../lib/api/rompimento';
import { TimelineList } from '../../components/TimelineList';
import { listCpTimeline, type TimelineEvent } from '../../lib/api/timeline';
import { captureException, trackDomainEvent } from '../../lib/telemetry';

const hoje = () => new Date().toISOString().slice(0, 10);
const ontem = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10); // deep-link 'atrasados': ate ontem = so vencidos
const fmtDate = (v: string | null | undefined) => !v ? '-' : v.split('-').reverse().join('/');
const nfmt = (n: number | null | undefined, d = 1) => n == null || !Number.isFinite(n) ? '-' : n.toFixed(d).replace('.', ',');
const normalize = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type EditState = { valor?: string; carga?: string; data?: string; hora?: string; tipo_ruptura?: string; massa_cp_g?: string; numeracao?: string };
type ImportLine = { key: string; numero: string; resultado: string; carga?: string; unidade?: string; massa?: string; data: string; hora: string; tipo: string; cp?: CpRompimento; ok: boolean; msg: string; conf?: number; origem?: string };

function cpNumero(c: CpRompimento): string {
  const md = c.metadata ?? {};
  return String(c.numeracao_lab ?? md.numeracao_lab ?? c.external_key ?? c.codigo ?? c.id.slice(0, 8));
}
function nf(c: CpRompimento): string { return String(c.material_receipts?.nota_fiscal ?? c.material_receipts?.external_key ?? '-'); }
function idade(c: CpRompimento): string { return `${c.idade_dias ?? '-'} ${c.idade_unidade === 'hora' ? 'horas' : 'dias'}`; }
function esperado(c: CpRompimento): number | null { return c.valor_esperado ?? c.concretagens?.fck_previsto ?? null; }
function clienteNome(c: CpRompimento): string { return String(c.concretagens?.lab_clients?.nome_fantasia ?? c.concretagens?.lab_clients?.razao_social ?? ''); }
function obraNome(c: CpRompimento): string { return String(c.concretagens?.client_works?.nome ?? ''); }
function statusBadge(c: CpRompimento): string {
  const r = resultadoAtual(c);
  if (c.situacao === 'descartado') return 'descartado';
  if (c.situacao === 'falhou') return 'falha';
  if (c.situacao === 'ausente') return 'ausente';
  if (r?.resultado_valor != null || c.situacao === 'rompido') return 'rompido';
  return 'pendente';
}
function isAtrasado(c: CpRompimento, ref: string): boolean { return !resultadoAtual(c) && c.situacao === 'pendente' && !!c.data_prevista_rompimento && c.data_prevista_rompimento < ref; }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const RUPTURA_AF: ReadonlyArray<[string, string]> = [
  ['A', 'Cônica'], ['B', 'Cônica e bipartida'], ['C', 'Colunar'],
  ['D', 'Cisalhada'], ['E', 'Paralela às bases'], ['F', 'Pontiaguda'],
];

export function RompimentosPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [tipoFiltro, setTipoFiltro] = useState('compressao');
  const [idadeFiltro, setIdadeFiltro] = useState('todas');
  const [nfFiltro, setNfFiltro] = useState('');
  const [janela, setJanela] = useState<'ate' | 'dia' | 'todos'>('dia');
  const [dataRef, setDataRef] = useState(hoje());
  const [adotarPrevista, setAdotarPrevista] = useState(false);
  const [adotarReferencia, setAdotarReferencia] = useState(false);
  const [mostrarLancados, setMostrarLancados] = useState(false);
  const [mostrarInsatisf, setMostrarInsatisf] = useState(false);
  // Deep-link da tela de Pendências: ?janela=hoje|atrasados|pendentes|insatisfatorios semeia os filtros uma vez
  // ('atrasados' usa dataRef=ontem para a lista casar com a contagem do card: prevista < hoje).
  const [sp, setSp] = useSearchParams();
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed único no mount
  useEffect(() => {
    const j = sp.get('janela');
    if (!j) return;
    if (j === 'hoje') { setJanela('dia'); setDataRef(hoje()); }
    else if (j === 'atrasados') { setJanela('ate'); setDataRef(ontem()); }
    else if (j === 'pendentes') { setJanela('todos'); setMostrarLancados(false); }
    else if (j === 'insatisfatorios') { setMostrarInsatisf(true); setJanela('todos'); }
    sp.delete('janela'); setSp(sp, { replace: true });
  }, []);
  const [entrarCarga, setEntrarCarga] = useState(false);
  const [cargaUnidade, setCargaUnidade] = useState<UnidadeCarga>('kn');
  const [diametro, setDiametro] = useState(100);
  const [altura, setAltura] = useState(200);
  const [prensaId, setPrensaId] = useState('');
  const [operadorId, setOperadorId] = useState('');
  const [capeamento, setCapeamento] = useState('');
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [curvaCp, setCurvaCp] = useState<CpRompimento | null>(null);
  const [auditCp, setAuditCp] = useState<CpRompimento | null>(null);
  const [auditItems, setAuditItems] = useState<TimelineEvent[]>([]);
  const [numCp, setNumCp] = useState<CpRompimento | null>(null);
  const [numValor, setNumValor] = useState('');
  const confirm = useConfirm();
  const [importOpen, setImportOpen] = useState(false);
  const [lendoAgenda, setLendoAgenda] = useState(false);
  const [importLines, setImportLines] = useState<ImportLine[]>([]);
  const [bulkData, setBulkData] = useState('');
  const [bulkHora, setBulkHora] = useState('');
  const [bulkTipo, setBulkTipo] = useState('');
  const [horaRef, setHoraRef] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('todas');
  const [obraFiltro, setObraFiltro] = useState('todas');
  const [prensaFiltro, setPrensaFiltro] = useState('todas');
  const [page, setPage] = useState(0);
  const [focoCpId, setFocoCpId] = useState<string | null>(null);

  const carregarTudo = mostrarLancados || mostrarInsatisf;
  const cpsQ = useQuery({ queryKey: ['rompimentos', member?.tenant_id, carregarTudo], queryFn: () => listCpsRompimento(member?.tenant_id, carregarTudo ? undefined : { situacao: 'pendente' }) });
  const resumoQ = useQuery({ queryKey: ['rompimentos', 'resumo', member?.tenant_id], enabled: !!member, queryFn: () => resumoRompimentos(member!.tenant_id) });
  const cfgQ = useQuery({ queryKey: ['config_controle_laudo', member?.tenant_id ?? 'none'], enabled: !!member, queryFn: () => getConfigLab(member?.tenant_id ?? '') });
  const equipRef = useQuery({ queryKey: ['equipamentos-ref'], queryFn: listEquipamentosRef });
  const prensas = useMemo(() => (equipRef.data ?? []).filter((e) => e.tipo === 'prensa' && e.ativo), [equipRef.data]);
  // Trava de prensa por colaborador (Fase 3): laboratorista com prensa(s) vinculada(s) fica restrito a elas.
  // admin/admin_consulte/gestor_qualidade escolhem qualquer prensa; sem vínculo = livre (comportamento antigo).
  const podeQualquerPrensa = hasRole('admin', 'admin_consulte', 'gestor_qualidade');
  const minhasPrensasQ = useQuery({ queryKey: ['minhas-prensas', member?.id], enabled: !!member?.id && !podeQualquerPrensa, queryFn: () => getColaboradorEquipamentosByMember(member!.id) });
  const minhasPrensas = useMemo(() => {
    if (podeQualquerPrensa) return null;
    const ids = new Set(minhasPrensasQ.data ?? []);
    const mine = prensas.filter((p) => ids.has(p.id));
    return mine.length ? mine : null;
  }, [podeQualquerPrensa, minhasPrensasQ.data, prensas]);
  const prensaTravada = !!minhasPrensas && minhasPrensas.length === 1;
  const prensasDisponiveis = minhasPrensas ?? prensas;
  useEffect(() => {
    if (!minhasPrensas) return;
    if (minhasPrensas.length === 1) { if (prensaId !== minhasPrensas[0].id) setPrensaId(minhasPrensas[0].id); }
    else if (!minhasPrensas.some((p) => p.id === prensaId)) setPrensaId(minhasPrensas[0].id);
  }, [minhasPrensas, prensaId]);
  // Prensa com unidade de carga cadastrada: pré-marca "Entrar carga" com a unidade dela.
  // Só liga (nunca desliga) — o usuário continua podendo desmarcar/trocar a unidade na sessão.
  useEffect(() => {
    const u = prensas.find((pp) => pp.id === prensaId)?.unidade_carga;
    if (u === 'kn' || u === 'tf' || u === 'kgf') { setEntrarCarga(true); setCargaUnidade(u); }
  }, [prensaId, prensas]);
  // Mapa id -> rótulo para a coluna "Prensa" na fila (inclui prensas inativas/apagadas usadas no passado).
  const equipById = useMemo(() => { const m = new Map<string, string>(); for (const e of equipRef.data ?? []) m.set(e.id, rotuloEquip(e)); return m; }, [equipRef.data]);
  const alocQ = useQuery({ queryKey: ['alocacao-obras'], queryFn: mapAlocacaoObras });
  // Prensa prevista de um CP pendente = prensa(s) alocada(s) à obra dele. workId vem do embed da concretagem.
  const prensasDaObra = (r: CpRompimento): string[] => {
    const w = r.concretagens?.work_id ?? null;
    return w ? (alocQ.data?.get(w) ?? []) : [];
  };
  const colabRef = useQuery({ queryKey: ['colaboradores-ref'], queryFn: listColaboradoresRef });
  const operadores = filtrarPorFuncao(colabRef.data ?? [], 'Laboratorista');

  const EC = initCampoState(CAMPOS_ENSAIO, cfgQ.data?.ensaio_campos ?? {});
  const campoTipo = EC.tipo_ruptura !== false;
  const campoPrensa = EC.prensa !== false;
  const campoCapeamento = EC.capeamento !== false;
  const campoMassa = EC.massa_cp_g !== false;
  const campoOperador = EC.operador !== false;
  const campoNumeracao = EC.numeracao_lab !== false;

  // Lote A — apoio às validações inline (2.1) e à incerteza (2.2)
  const idadeControle = Number(cfgQ.data?.idade_controle_default) || 28;
  // Idade de controle POR CP: traço (operational_materials.idade_controle_dias, mig 135) > config_lab > 28.
  function idadeCtrlDe(cp: CpRompimento): number { return Number(cp.concretagens?.operational_materials?.idade_controle_dias ?? idadeControle) || idadeControle; }
  function isIdadeControle(cp: CpRompimento): boolean { return cp.idade_unidade !== 'hora' && Number(cp.idade_dias) === idadeCtrlDe(cp); }
  const prensaSel = prensas.find((pp) => pp.id === prensaId) ?? null;
  const calibVencida = !!prensaSel?.validade_calibracao && prensaSel.validade_calibracao < hoje();
  function mpaForaFaixa(v: number): boolean { return Number.isFinite(v) && (v <= 0 || v > 120); }

  const rows = cpsQ.data ?? [];
  // B1 — dispersão do par (gêmeos): mapa amostra+idade -> resultados, para marcar aviso quando Δ% > limite.
  const dispLimite = Number((cfgQ.data as { dispersao_par_limite_pct?: number } | undefined)?.dispersao_par_limite_pct) || 6;
  const dispPares = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of rows) {
      if (!r.amostra_id || r.idade_unidade === 'hora') continue;
      const v = resultadoAtual(r)?.resultado_valor;
      if (v == null || !Number.isFinite(Number(v))) continue;
      const k = r.amostra_id + '|' + String(r.idade_dias ?? '');
      const arr = m.get(k) ?? []; arr.push(Number(v)); m.set(k, arr);
    }
    return m;
  }, [rows]);
  function dispDe(cp: CpRompimento): number | null {
    if (!cp.amostra_id || cp.idade_unidade === 'hora') return null;
    return dispersaoPct(dispPares.get(cp.amostra_id + '|' + String(cp.idade_dias ?? '')) ?? []);
  }
  const tipos = useMemo(() => {
    const values = new Map<string, string>();
    for (const r of rows) {
      const nome = r.material_test_types?.nome ?? r.material_test_types?.codigo ?? 'compressao';
      const key = normalize(nome).includes('compress') ? 'compressao' : normalize(nome).replace(/\s+/g, '_') || 'outro';
      values.set(key, key === 'compressao' ? 'compressao' : String(nome));
    }
    if (!values.has('compressao')) values.set('compressao', 'compressao');
    return [...values.entries()];
  }, [rows]);
  const idades = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(`${r.idade_dias ?? '-'} ${r.idade_unidade === 'hora' ? 'horas' : 'dias'}`);
    return [...set].sort((a, b) => Number(a.split(' ')[0]) - Number(b.split(' ')[0]));
  }, [rows]);
  const clientesOpts = useMemo(() => [...new Set(rows.map(clienteNome).filter(Boolean))].sort(), [rows]);
  const obrasOpts = useMemo(() => [...new Set(rows.filter((r) => clienteFiltro === 'todas' || clienteNome(r) === clienteFiltro).map(obraNome).filter(Boolean))].sort(), [rows, clienteFiltro]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: prensasDaObra fecha sobre alocQ.data, já nas deps
  const filtradas = useMemo(() => rows.filter((r) => {
    const tipoNome = r.material_test_types?.nome ?? r.material_test_types?.codigo ?? 'compressao';
    const tipoKey = normalize(tipoNome).includes('compress') ? 'compressao' : normalize(tipoNome).replace(/\s+/g, '_') || 'outro';
    if (tipoFiltro !== 'todas' && tipoKey !== tipoFiltro) return false;
    if (idadeFiltro !== 'todas' && idade(r) !== idadeFiltro) return false;
    if (clienteFiltro !== 'todas' && clienteNome(r) !== clienteFiltro) return false;
    if (obraFiltro !== 'todas' && obraNome(r) !== obraFiltro) return false;
    if (prensaFiltro !== 'todas') {
      const eq = resultadoAtual(r)?.equipamento_id ?? null;
      const aloc = eq ? [] : prensasDaObra(r); // pendente usa alocação; lançado usa a prensa gravada
      if (prensaFiltro === 'sem') { if (eq || aloc.length > 0) return false; }
      else if (!(eq === prensaFiltro || aloc.includes(prensaFiltro))) return false;
    }
    const busca = normalize([cpNumero(r), r.codigo, nf(r), r.concretagens?.numero_relatorio, r.concretagens?.codigo, r.concretagens?.client_works?.nome].join(' '));
    if (nfFiltro.trim() && !busca.includes(normalize(nfFiltro))) return false;
    if (janela !== 'todos') {
      if (!r.data_prevista_rompimento) return false;
      if (janela === 'ate' && r.data_prevista_rompimento > dataRef) return false;
      if (janela === 'dia' && r.data_prevista_rompimento !== dataRef) return false;
    }
    const res = resultadoAtual(r)?.resultado_valor ?? null;
    if (!mostrarLancados && res != null) return false;
    if (mostrarInsatisf) {
      const esp = esperado(r);
      const naIdade = isIdadeControle(r);
      if (res == null || esp == null || res >= esp || !naIdade) return false;
    }
    return true;
  }), [rows, tipoFiltro, idadeFiltro, nfFiltro, janela, dataRef, mostrarLancados, mostrarInsatisf, idadeControle, clienteFiltro, obraFiltro, prensaFiltro, alocQ.data]);

  // Contadores globais vindos da RPC (corretos independentemente do recorte carregado na grade).
  const countPend = resumoQ.data?.pendente ?? 0;
  const countAtr = resumoQ.data?.atrasado ?? 0;
  const countRom = resumoQ.data?.rompido ?? 0;
  const countIns = resumoQ.data?.insatisfatorio ?? 0;
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageStart = pageSafe * PAGE_SIZE;
  const pageRows = filtradas.slice(pageStart, pageStart + PAGE_SIZE);

  // Agenda por prensa: contagem no recorte filtrado. Lançado conta pela prensa gravada;
  // pendente conta pela prensa alocada à obra (prevista). "Sem prensa" = pendente sem alocação.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prensasDaObra fecha sobre alocQ.data, já nas deps
  const contagemPrensa = useMemo(() => {
    const m = new Map<string, number>(); let sem = 0;
    for (const r of filtradas) {
      const eq = resultadoAtual(r)?.equipamento_id ?? null;
      const ids = eq ? [eq] : prensasDaObra(r);
      if (ids.length === 0) { sem++; continue; }
      for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return { porPrensa: [...m.entries()].sort((a, b) => b[1] - a[1]), sem };
  }, [filtradas, alocQ.data]);

  // Pré-seleção da prensa pela alocação: quando uma obra específica está filtrada e tem exatamente
  // 1 prensa ativa alocada, sugere-a (sem sobrescrever escolha manual). N alocadas → não presume.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filtradas/obraNome derivam de deps já listadas
  useEffect(() => {
    if (!campoPrensa || prensaId || obraFiltro === 'todas') return;
    const alvo = filtradas.find((r) => obraNome(r) === obraFiltro);
    const w = alvo?.concretagens?.work_id ?? null;
    const ids = (w ? (alocQ.data?.get(w) ?? []) : []).filter((id) => prensas.some((p) => p.id === id));
    if (ids.length === 1) setPrensaId(ids[0]);
  }, [obraFiltro, alocQ.data, campoPrensa, prensas]);

  // Fase 2 das etiquetas: leitor USB de QR age como teclado e digita "CP:<uuid>" na busca.
  // Localiza o CP no vivo (RLS), zera filtros que poderiam escondê-lo, isola pelo código
  // (único por CP) e agenda o foco no campo de carga.
  function focarCp(cp: CpQr) {
    setTipoFiltro('todas'); setIdadeFiltro('todas'); setClienteFiltro('todas'); setObraFiltro('todas');
    setJanela('todos'); setMostrarInsatisf(false); setPrensaFiltro('todas'); setPage(0);
    if (cp.lancado || (cp.situacao && cp.situacao !== 'pendente')) setMostrarLancados(true);
    setNfFiltro(cp.codigo ?? cp.numeracao_lab ?? '');
    setFocoCpId(cp.id);
    const rotulo = cp.numeracao_lab || cp.codigo || '';
    if (cp.lancado) toast('CP ' + rotulo + ' já lançado — exibindo para conferência.', 'info');
    else if (cp.situacao === 'descartado') toast('CP ' + rotulo + ' está descartado.', 'info');
    else toast('CP ' + rotulo + ' localizado.', 'success');
  }
  async function bipEtiqueta(cpId: string) {
    try {
      const cp = await cpPorQr(cpId);
      if (!cp) { toast('CP da etiqueta não encontrado neste laboratório.', 'error'); return; }
      focarCp(cp);
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function bipNumeracao(num: string) {
    try {
      const cp = await cpPorNumeracao(num);
      if (!cp) { toast('Etiqueta ' + num + ' ainda não vinculada a um CP.', 'info'); return; }
      focarCp(cp);
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  useEffect(() => {
    if (!focoCpId) return;
    const idx = pageRows.findIndex((r) => r.id === focoCpId);
    if (idx < 0) return; // aguardando refetch (lançados) ou re-filtro
    const el = document.getElementById(`romp-val-${idx}`) as HTMLInputElement | null;
    if (!el) return;
    el.focus(); el.select();
    el.scrollIntoView({ block: 'center' });
    setFocoCpId(null);
  }, [focoCpId, pageRows]);

  function patch(id: string, values: Partial<EditState>) { setEdits((s) => ({ ...s, [id]: { ...(s[id] ?? {}), ...values } })); }
  async function salvarNumeracao() {
    if (!numCp) return;
    const novo = numValor.trim();
    const atual = (numCp.numeracao_lab ?? '').trim();
    if (atual && novo !== atual) {
      const msg = novo ? 'Este CP já tem a numeração ' + atual + ' (definida na moldagem/etiqueta). Substituir por ' + novo + '?' : 'Remover a numeração ' + atual + ' deste CP?';
      if (!(await confirm({ title: 'Alterar numeração do CP', message: msg, danger: true, confirmLabel: novo ? 'Substituir' : 'Remover' }))) return;
    }
    try { await setNumeracaoCp(numCp, novo); setNumCp(null); await qc.invalidateQueries({ queryKey: ['rompimentos'] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  function effectiveData(cp: CpRompimento): string {
    const e = edits[cp.id];
    const saved = resultadoAtual(cp);
    return e?.data ?? saved?.data_rompimento ?? (adotarPrevista ? cp.data_prevista_rompimento ?? '' : adotarReferencia ? dataRef : '');
  }
  function effectiveHora(cp: CpRompimento): string { return edits[cp.id]?.hora ?? resultadoAtual(cp)?.hora_rompimento ?? ((adotarPrevista || adotarReferencia) ? horaRef : ''); }
  function effectiveValor(cp: CpRompimento): string { return edits[cp.id]?.valor ?? (resultadoAtual(cp)?.resultado_valor != null ? String(resultadoAtual(cp)?.resultado_valor) : ''); }
  function effectiveCarga(cp: CpRompimento): string { return edits[cp.id]?.carga ?? (resultadoAtual(cp)?.carga_ruptura_kn != null ? String(resultadoAtual(cp)?.carga_ruptura_kn) : ''); }
  function effectiveTipo(cp: CpRompimento): string { return edits[cp.id]?.tipo_ruptura ?? resultadoAtual(cp)?.tipo_ruptura ?? ''; }
  function effectiveMassa(cp: CpRompimento): string { return edits[cp.id]?.massa_cp_g ?? (resultadoAtual(cp)?.massa_cp_g != null ? String(resultadoAtual(cp)?.massa_cp_g) : ''); }

  async function salvarLinhas(linhas: CpRompimento[]) {
    if (!member) return;
    setBusy(true);
    try {
      const itens: Array<Record<string, unknown>> = [];
      let skip = 0;
      for (const cp of linhas) {
        // Não re-grava um CP já lançado que não foi editado.
        if (resultadoAtual(cp) && !edits[cp.id]) continue;
        const data = effectiveData(cp);
        const resultNumber = entrarCarga ? cargaParaMpa(Number(effectiveCarga(cp)), cargaUnidade, diametro, altura) : Number(effectiveValor(cp));
        if (!data || !Number.isFinite(resultNumber) || resultNumber <= 0) { skip++; continue; }
        itens.push({
          corpo_prova_id: cp.id,
          resultado_valor: resultNumber,
          carga_ruptura: entrarCarga ? Number(effectiveCarga(cp)) : null,
          carga_unidade: cargaUnidade,
          carga_ruptura_kn: entrarCarga && cargaUnidade === 'kn' ? Number(effectiveCarga(cp)) : null,
          cp_diametro_mm: diametro,
          cp_altura_mm: altura,
          tipo_ruptura: campoTipo ? effectiveTipo(cp) || null : null,
          capeamento: campoCapeamento ? capeamento || resultadoAtual(cp)?.capeamento || null : null,
          massa_cp_g: campoMassa && effectiveMassa(cp) ? Number(effectiveMassa(cp)) : null,
          equipamento_id: campoPrensa ? prensaId || resultadoAtual(cp)?.equipamento_id || null : null,
          operador_id: campoOperador ? (operadorId || resultadoAtual(cp)?.operador_id || null) : null,
          data_rompimento: data,
          hora_rompimento: effectiveHora(cp) || null,
          origem_log: 'rompimentos_geolab_v23',
        });
      }
      if (!itens.length) throw new Error(skip ? 'Nenhum CP com resultado e data válidos para salvar.' : 'Nada a salvar: os CPs do recorte já estão lançados (edite um valor para regravar).');
      // 1 RPC de lote (transacao server-side) + notifica 1x por amostra abaixo do fck.
      const { ok, abaixoFck } = await lancarRompimentosLote(itens, idadeControle);
      for (const a of abaixoFck) await notifyAbaixoFck(member.tenant_id, a);
      await qc.invalidateQueries({ queryKey: ['rompimentos'] });
      toast(`${ok} resultado(s) salvo(s)${skip ? ` · ${skip} sem resultado/data ignorado(s)` : ''}.`, 'success');
      setSelecionados(new Set());
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function salvarRecorte() {
    const linhas = selecionados.size ? filtradas.filter((r) => selecionados.has(r.id)) : filtradas;
    await salvarLinhas(linhas);
  }

  async function alterarSituacao(cp: CpRompimento, situacao: 'descartado' | 'falhou' | 'ausente' | 'pendente') {
    try {
      await lancarSituacaoCp(cp, situacao, situacao === 'pendente' ? undefined : `Marcado como ${situacao} pela tela de resultados`);
      await qc.invalidateQueries({ queryKey: ['rompimentos'] });
      toast('Situação atualizada.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function alterarSituacaoConfirm(cp: CpRompimento, situacao: 'falhou' | 'ausente') {
    const rotulo = situacao === 'falhou' ? 'falha' : 'ausente';
    if (!(await confirm({ title: 'Marcar CP como ' + rotulo, message: 'Marcar o CP ' + cpNumero(cp) + ' como ' + rotulo + '? D\u00e1 para reverter depois pela a\u00e7\u00e3o Reativar, na mesma linha.', danger: true, confirmLabel: 'Marcar ' + rotulo }))) return;
    await alterarSituacao(cp, situacao);
  }

  async function contraprovaConfirm(cp: CpRompimento) {
    if (!(await confirm({ title: 'Gerar contraprova', message: 'Gerar contraprova de ' + cpNumero(cp) + '? Um novo CP pendente ser\u00e1 criado.', confirmLabel: 'Gerar contraprova' }))) return;
    try { await gerarContraprova(cp); await qc.invalidateQueries({ queryKey: ['rompimentos'] }); toast('Contraprova criada.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  async function abrirAudit(cp: CpRompimento) {
    setAuditCp(cp); setAuditItems([]);
    try { setAuditItems(await listCpTimeline(cp.id)); } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function exportarModelo() {
    const { exportExcel } = await import('../../lib/export/xlsx');
    const data = filtradas.map((r) => ({
      corpo_prova_id: r.id,
      numeracao: cpNumero(r),
      codigo_cp: r.codigo ?? '',
      nota_fiscal: nf(r),
      idade: idade(r),
      data_prevista: r.data_prevista_rompimento ?? '',
      resultado_mpa: effectiveValor(r),
      carga: effectiveCarga(r),
      unidade_carga: cargaUnidade,
      data_rompimento: effectiveData(r),
      hora_rompimento: effectiveHora(r),
      tipo_ruptura: effectiveTipo(r),
      massa_cp_g: effectiveMassa(r),
    }));
    await exportExcel(
      { title: 'Modelo de rompimentos', filename: `modelo-rompimentos-${dataRef}.xlsx` },
      {
        name: 'rompimentos',
        template: true,
        columns: [
          { key: 'corpo_prova_id', header: 'corpo_prova_id', width: 16 },
          { key: 'numeracao', header: 'numeracao', align: 'center' },
          { key: 'codigo_cp', header: 'codigo_cp', align: 'center' },
          { key: 'nota_fiscal', header: 'nota_fiscal', align: 'center' },
          { key: 'idade', header: 'idade', align: 'center' },
          { key: 'data_prevista', header: 'data_prevista', align: 'center' },
          { key: 'resultado_mpa', header: 'resultado_mpa', align: 'center' },
          { key: 'carga', header: 'carga', align: 'center' },
          { key: 'unidade_carga', header: 'unidade_carga', align: 'center' },
          { key: 'data_rompimento', header: 'data_rompimento', align: 'center' },
          { key: 'hora_rompimento', header: 'hora_rompimento', align: 'center' },
          { key: 'tipo_ruptura', header: 'tipo_ruptura', align: 'center' },
          { key: 'massa_cp_g', header: 'massa_cp_g', align: 'center' },
        ],
        rows: data,
      },
    );
  }

  async function exportarFila() {
    const { exportExcel } = await import('../../lib/export/xlsx');
    const data = filtradas.map((r) => {
      const res = resultadoAtual(r);
      return {
        numeracao: cpNumero(r),
        obra: r.concretagens?.client_works?.nome ?? '',
        concretagem: r.concretagens?.codigo ?? '',
        nota_fiscal: nf(r),
        idade: idade(r),
        data_prevista: r.data_prevista_rompimento ?? '',
        data_rompimento: res?.data_rompimento ?? '',
        resultado_mpa: res?.resultado_valor ?? '',
        esperado_mpa: esperado(r) ?? '',
        situacao: statusBadge(r),
      };
    });
    await exportExcel(
      { title: 'Fila de rompimentos', filename: `fila-rompimentos-${dataRef}.xlsx` },
      {
        name: 'fila',
        columns: [
          { key: 'numeracao', header: 'Numeração', align: 'center' },
          { key: 'obra', header: 'Obra' },
          { key: 'concretagem', header: 'Concretagem', align: 'center' },
          { key: 'nota_fiscal', header: 'Nota fiscal', align: 'center' },
          { key: 'idade', header: 'Idade', align: 'center' },
          { key: 'data_prevista', header: 'Data prevista', format: 'date' },
          { key: 'data_rompimento', header: 'Data rompimento', format: 'date' },
          { key: 'resultado_mpa', header: 'Resultado (MPa)', format: 'dec1' },
          { key: 'esperado_mpa', header: 'Esperado (MPa)', format: 'dec1' },
          { key: 'situacao', header: 'Situação', align: 'center' },
        ],
        rows: data,
      },
    );
  }

  async function exportarAgenda(agruparPrensa = false) {
    try {
      const blob = await gerarAgendaPdf({ tipo_ensaio: tipoFiltro, idade: idadeFiltro, janela, data_ref: dataRef, nota_fiscal: nfFiltro, cliente: clienteFiltro, obra: obraFiltro, entrar_carga: entrarCarga, carga_unidade: cargaUnidade, agrupar_prensa: agruparPrensa });
      downloadBlob(blob, `agenda-rompimentos-${dataRef}${agruparPrensa ? '-por-prensa' : ''}.pdf`);
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  function importarArquivo(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const XLSX = await import('xlsx-js-style');
        const wb = XLSX.read(reader.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        const linhas = json.map((r, idx) => {
          const keys = Object.keys(r);
          const get = (...names: string[]) => {
            for (const n of names) {
              const k = keys.find((x) => normalize(x) === normalize(n));
              if (k) return String(r[k] ?? '').trim();
            }
            return '';
          };
          const key = get('corpo_prova_id', 'id', 'cp_id');
          const numero = get('numeracao', 'numeração', 'codigo_cp', 'cp', 'numero');
          const resultado = get('resultado_mpa', 'resultado', 'mpa');
          const carga = get('carga', 'carga_kn', 'carga_ruptura');
          const unidade = get('unidade_carga', 'unidade') || 'kn';
          const massa = get('massa_cp_g', 'massa');
          const data = get('data_rompimento', 'data realizado', 'data_realizado', 'data');
          const hora = get('hora_rompimento', 'hora');
          const tipo = get('tipo_ruptura', 'ruptura');
          const cp = rows.find((c) => c.id === key || normalize(cpNumero(c)) === normalize(numero) || normalize(c.codigo) === normalize(numero));
          const temValor = !!resultado || !!carga;
          return { key: key || `linha-${idx + 2}`, numero, resultado, carga, unidade, massa, data, hora, tipo, cp, ok: !!cp && temValor, msg: cp ? (temValor ? 'pronto' : 'sem resultado/carga') : 'CP não localizado' } satisfies ImportLine;
        });
        setImportLines(linhas);
      } catch (e) { toast((e as Error).message, 'error'); }
    };
    reader.readAsArrayBuffer(file);
  }

  function importarAgendaFoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setLendoAgenda(true);
      try {
        const b64 = String(reader.result).split(',')[1] ?? '';
        const res = await ocrAgendaRompimento(b64, file.type || 'image/jpeg');
        if (!res.enabled) { toast(res.reason || 'OCR indisponível (VISION_API_KEY não configurada).', 'info'); return; }
        if (!res.linhas.length) { toast('Nenhuma linha reconhecida na foto — tente uma imagem mais nítida e reta.', 'info'); return; }
        const linhas: ImportLine[] = res.linhas.map((l, idx) => {
          const numero = String(l.numeracao ?? '').trim();
          const resultado = l.resultado_mpa != null ? String(l.resultado_mpa) : '';
          const carga = l.carga != null ? String(l.carga) : undefined;
          const cp = rows.find((r) => normalize(cpNumero(r)) === normalize(numero) || normalize(r.codigo) === normalize(numero) || normalize(r.numeracao_lab ?? '') === normalize(numero));
          const temValor = !!resultado || !!carga;
          return { key: numero || `linha-${idx + 1}`, numero, resultado, carga, unidade: 'kn', massa: '', data: l.data_rompimento ?? '', hora: l.hora ?? '', tipo: l.tipo_ruptura ?? '', cp, ok: !!cp && temValor, conf: l.conf ?? undefined, origem: 'importacao_agenda_ocr', msg: cp ? (temValor ? 'pronto' : 'sem resultado') : 'CP não localizado' } satisfies ImportLine;
        });
        setImportLines(linhas); setImportOpen(true);
      } catch (e) { toast((e as Error).message, 'error'); } finally { setLendoAgenda(false); }
    };
    reader.readAsDataURL(file);
  }

  async function aplicarImportacao() {
    if (!member) return;
    setBusy(true);
    try {
      let ok = 0;
      const erros: string[] = [];
      const linhas = importLines.filter((x) => x.ok && x.cp);
      for (const [idx, l] of linhas.entries()) {
        try {
          const temResultado = !!l.resultado && Number.isFinite(Number(String(l.resultado).replace(',', '.')));
          await lancarRompimentoCp(member.tenant_id, l.cp as CpRompimento, {
            resultado_valor: temResultado ? Number(String(l.resultado).replace(',', '.')) : null,
            carga_ruptura: l.carga ? Number(String(l.carga).replace(',', '.')) : null,
            carga_unidade: (l.unidade as UnidadeCarga) || 'kn',
            massa_cp_g: l.massa ? Number(String(l.massa).replace(',', '.')) : null,
            cp_diametro_mm: diametro,
            cp_altura_mm: altura,
            tipo_ruptura: l.tipo || null,
            data_rompimento: l.data || dataRef,
            hora_rompimento: l.hora || null,
            equipamento_id: campoPrensa ? (prensaId || (l.cp as CpRompimento) && resultadoAtual(l.cp as CpRompimento)?.equipamento_id || null) : null,
            origem_log: l.origem || 'importacao_planilha_rompimento',
          });
          ok++;
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          erros.push(`${l.numero || idx + 1}: ${reason}`);
          captureException(e, { category: 'domain', metadata: { action: 'rompimento.importacao_linha', linha_numero: idx + 1, numeracao: l.numero, corpo_prova_id: l.cp?.id, concretagem_id: l.cp?.concretagem_id, origem: l.origem || 'importacao_planilha_rompimento' } });
          trackDomainEvent('rompimento.importacao_linha_falhou', { linha_numero: idx + 1, numeracao: l.numero, corpo_prova_id: l.cp?.id, reason });
        }
      }
      await qc.invalidateQueries({ queryKey: ['rompimentos'] });
      if (ok > 0) {
        toast(`${ok} linha(s) importada(s)` + (erros.length ? ` · ${erros.length} com erro.` : '.'), erros.length ? 'warning' : 'success');
        if (!erros.length) { setImportOpen(false); setImportLines([]); }
      } else {
        toast('Falha ao importar todas as linhas: ' + (erros[0] ?? 'erro'), 'error');
      }
    } finally { setBusy(false); }
  }

  function toggleSelecionado(id: string) {
    setSelecionados((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleTodos() {
    setSelecionados((old) => old.size === filtradas.length ? new Set() : new Set(filtradas.map((r) => r.id)));
  }
  function aplicarAosSelecionados() {
    if (!selecionados.size) return;
    const vals: Partial<EditState> = {};
    if (bulkData) vals.data = bulkData;
    if (bulkHora) vals.hora = bulkHora;
    if (bulkTipo) vals.tipo_ruptura = bulkTipo;
    if (!Object.keys(vals).length) { toast('Defina data, hora ou ruptura para aplicar.', 'info'); return; }
    setEdits((s) => { const next = { ...s }; for (const id of selecionados) next[id] = { ...(next[id] ?? {}), ...vals }; return next; });
    toast(`Aplicado a ${selecionados.size} CP(s).`, 'success');
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, rowIndex: number) {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const values = text.split('\n').map((s) => s.split('\t')[0].trim());
    while (values.length && values[values.length - 1] === '') values.pop();
    if (values.length <= 1) return;
    e.preventDefault();
    const key: 'carga' | 'valor' = entrarCarga ? 'carga' : 'valor';
    let n = 0;
    setEdits((s) => {
      const next = { ...s };
      for (let i = 0; i < values.length && rowIndex + i < filtradas.length; i++) {
        const cp = filtradas[rowIndex + i];
        next[cp.id] = { ...(next[cp.id] ?? {}), [key]: values[i].replace(',', '.') };
        n++;
      }
      return next;
    });
    toast(n + ' valor(es) colado(s) na coluna.', 'success');
  }

  const curvaRows = curvaCp ? rows.filter((r) => r.amostra_id && r.amostra_id === curvaCp.amostra_id) : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker">Concreto · Controle Tecnológico</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-slate-950 dark:text-slate-50">Resultados de Ensaios</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Lançamento do rompimento de CPs no padrão do laboratório: filtre a agenda pela data de referência, digite o resultado (Enter pula para o próximo), marque descartes e Salvar grava tudo em lote. Em massa: Exportar modelo → preencher → Importar resultados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void exportarAgenda(false)}>Agenda (PDF)</Button>
          {campoPrensa && (alocQ.data?.size ?? 0) > 0 ? <Button variant="secondary" onClick={() => void exportarAgenda(true)} title="Agenda agrupada por prensa prevista (alocação da obra)">Agenda por prensa</Button> : null}
          <Button variant="secondary" onClick={() => void exportarFila()}>Exportar fila</Button>
          <Button variant="secondary" onClick={exportarModelo} title="Baixe o modelo, preencha os resultados e use Importar resultados">Exportar modelo (p/ importar)</Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>Importar resultados</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Tipo de ensaio</span><select className="input" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}><option value="todas">Todos</option>{tipos.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Idade</span><select className="input" value={idadeFiltro} onChange={(e) => setIdadeFiltro(e.target.value)}><option value="todas">Todas</option>{idades.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Buscar</span><input className="input" placeholder="Nº relatório, NF, código, numeração ou bipe o QR da etiqueta" value={nfFiltro} onChange={(e) => { const v = e.target.value; const m = /^CP:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/.exec(v.trim()); if (m) { setNfFiltro(''); void bipEtiqueta(m[1]); } else if (/^\d{4,6}\/\d{2}$/.test(v.trim())) { const t = v.trim(); setNfFiltro(t); void bipNumeracao(t); } else setNfFiltro(v); }} /></label><label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Cliente / construtora</span><select className="input" value={clienteFiltro} onChange={(e) => { setClienteFiltro(e.target.value); setObraFiltro('todas'); setPage(0); }}><option value="todas">Todos</option>{clientesOpts.map((c) => <option key={c} value={c}>{c}</option>)}</select></label><label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Obra</span><select className="input" value={obraFiltro} onChange={(e) => { setObraFiltro(e.target.value); setPage(0); }}><option value="todas">Todas</option>{obrasOpts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>{prensas.length > 0 ? <label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Prensa</span><select className="input" value={prensaFiltro} onChange={(e) => { setPrensaFiltro(e.target.value); setPage(0); }}><option value="todas">Todas</option>{prensas.map((p) => <option key={p.id} value={p.id}>{rotuloEquip(p)}</option>)}<option value="sem">Sem prensa</option></select></label> : null}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" checked={janela === 'ate'} onChange={() => setJanela('ate')} /> Até o Dia Ref.</label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" checked={janela === 'dia'} onChange={() => setJanela('dia')} /> Do Dia Ref.</label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" checked={janela === 'todos'} onChange={() => setJanela('todos')} /> Todos</label>
            <label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Data de referência</span><input className="input" type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} /></label><label className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Hora de referência</span><input className="input max-w-[120px]" type="time" value={horaRef} onChange={(e) => setHoraRef(e.target.value)} /></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-bold">
            <label className="flex items-center gap-2"><input type="checkbox" checked={adotarPrevista} onChange={(e) => { setAdotarPrevista(e.target.checked); if (e.target.checked) setAdotarReferencia(false); }} /> Adotar Data e Hora Prevista</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={adotarReferencia} onChange={(e) => { setAdotarReferencia(e.target.checked); if (e.target.checked) setAdotarPrevista(false); }} /> Adotar Data e Hora Referência</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={mostrarLancados} onChange={(e) => setMostrarLancados(e.target.checked)} /> Mostrar Lançados</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={mostrarInsatisf} onChange={(e) => setMostrarInsatisf(e.target.checked)} /> Mostrar Apenas Insatisfatórios</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={entrarCarga} onChange={(e) => setEntrarCarga(e.target.checked)} /> Entrar carga (converte p/ MPa)</label>
          </div>
          {entrarCarga ? <div className="mt-3 grid gap-3 md:grid-cols-4"><label className="block space-y-1"><span className="text-sm font-bold">Unidade da carga</span><select className="input" value={cargaUnidade} onChange={(e) => setCargaUnidade(e.target.value as UnidadeCarga)}><option value="kn">kN</option><option value="tf">tf</option><option value="kgf">kgf</option></select></label><label className="block space-y-1"><span className="text-sm font-bold">Diâmetro (mm)</span><input className="input" type="number" min={50} max={300} step="1" value={diametro} onChange={(e) => setDiametro(Number(e.target.value) || 100)} onBlur={(e) => setDiametro(clampNum(e.target.value, { min: 50, max: 300, dec: 0 }) ?? 100)} /></label><label className="block space-y-1"><span className="text-sm font-bold">Altura (mm)</span><input className="input" type="number" min={50} max={600} step="1" value={altura} onChange={(e) => setAltura(Number(e.target.value) || 200)} onBlur={(e) => setAltura(clampNum(e.target.value, { min: 50, max: 600, dec: 0 }) ?? 200)} /></label><div className="flex flex-wrap items-end gap-2">{DIMENSOES_CP.map((d) => <button type="button" key={d.label} className="rounded-md border border-slate-200 px-2 py-2 text-xs font-bold" onClick={() => { setDiametro(d.diametroMm); setAltura(d.alturaMm); }}>{d.label}</button>)}</div></div> : null}
          {(campoPrensa || campoCapeamento) ? <div className="mt-3 grid gap-3 md:grid-cols-2">{campoPrensa ? <label className="block space-y-1"><span className="text-sm font-bold">Prensa utilizada</span><select className="input" value={prensaId} onChange={(e) => setPrensaId(e.target.value)} disabled={prensaTravada}><option value="">-</option>{prensasDisponiveis.map((o) => <option key={o.id} value={o.id}>{rotuloEquip(o)}</option>)}</select>{prensaSel ? <span className="mt-1 block text-xs font-bold text-slate-500">{prensaSel.incerteza_mpa != null ? `Incerteza: ± ${nfmt(prensaSel.incerteza_mpa, 2)} MPa` : 'Incerteza não cadastrada'}{prensaSel.validade_calibracao ? ` · calibração até ${fmtDate(prensaSel.validade_calibracao)}` : ''}</span> : prensasDisponiveis.length > 1 ? <span className="mt-1 block text-xs text-slate-500">Selecione a prensa desta sessão — fica gravada em cada CP lançado.</span> : null}{prensaTravada ? <span className="mt-1 block text-xs text-slate-500">Prensa fixada pelo seu cadastro de colaborador.</span> : null}{calibVencida ? <span className="mt-1 block text-xs font-bold text-amber-600">⚠ Calibração vencida — o resultado gerará NC (T-14). Não bloqueia o lançamento.</span> : null}</label> : null}{campoCapeamento ? <label className="block space-y-1"><span className="text-sm font-bold">Capeamento / bases</span><select className="input" value={capeamento} onChange={(e) => setCapeamento(e.target.value)}><option value="">-</option>{['Retífica', 'Neoprene', 'Enxofre', 'Sem capeamento'].map((x) => <option key={x} value={x}>{x}</option>)}</select></label> : null}</div> : null}
          {campoOperador ? <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="block space-y-1"><span className="text-sm font-bold">Operador (quem rompeu)</span><select className="input" value={operadorId} onChange={(e) => setOperadorId(e.target.value)} aria-label="Operador do rompimento"><option value="">-</option>{operadores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Gravado em cada CP lançado nesta sessão.</span></label></div> : null}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{filtradas.length} CP(s) no recorte</span>
        {rows.length >= ROMP_CAP ? <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800" title="A lista foi limitada para desempenho. Refine por cliente, obra ou busca para carregar o restante — os contadores acima permanecem exatos.">lista limitada a {ROMP_CAP} — refine os filtros</span> : null}
        <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">{countPend} pendente(s)</span>
        <span className="rounded-md bg-red-100 px-2 py-1 text-red-700">{countAtr} atrasado(s)</span>
        <span className="rounded-md bg-green-100 px-2 py-1 text-green-700">{countRom} rompido(s)</span>
        {countIns ? <span className="rounded-md bg-red-100 px-2 py-1 text-red-700">{countIns} insatisfatório(s)</span> : null}
        {selecionados.size ? <span className="rounded-md bg-blue-100 px-2 py-1 text-blue-700">{selecionados.size} selecionado(s)</span> : null}
        <div className="ml-auto"><Button onClick={() => void salvarRecorte()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar resultados'}</Button></div>
      </div>

      {campoPrensa && (contagemPrensa.porPrensa.length > 0 || contagemPrensa.sem > 0) ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wide text-slate-400">Por prensa (recorte)</span>
          {contagemPrensa.porPrensa.map(([id, n]) => <button type="button" key={id} onClick={() => { setPrensaFiltro(id); setPage(0); }} className={'rounded-full border px-2.5 py-1 font-bold ' + (prensaFiltro === id ? 'border-transparent bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300')}>{equipById.get(id) ?? '—'}: {n}</button>)}
          {contagemPrensa.sem > 0 ? <button type="button" onClick={() => { setPrensaFiltro('sem'); setPage(0); }} className={'rounded-full border px-2.5 py-1 font-bold ' + (prensaFiltro === 'sem' ? 'border-transparent bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400')}>sem prensa: {contagemPrensa.sem}</button> : null}
          {prensaFiltro !== 'todas' ? <button type="button" onClick={() => { setPrensaFiltro('todas'); setPage(0); }} className="font-bold text-blue-600">limpar</button> : null}
        </div>
      ) : null}

      {selecionados.size ? <div className="flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/20"><span className="font-bold text-blue-800 dark:text-blue-300">Aplicar a {selecionados.size} selecionado(s):</span><input className="input max-w-[150px]" type="date" value={bulkData} onChange={(e) => setBulkData(e.target.value)} /><input className="input max-w-[110px]" type="time" value={bulkHora} onChange={(e) => setBulkHora(e.target.value)} />{campoTipo ? <select className="input max-w-[100px]" value={bulkTipo} onChange={(e) => setBulkTipo(e.target.value)}><option value="">ruptura</option>{['A', 'B', 'C', 'D', 'E', 'F'].map((x) => <option key={x} value={x}>{x}</option>)}</select> : null}<Button variant="secondary" onClick={aplicarAosSelecionados}>Aplicar</Button></div> : null}
      {campoTipo ? <details className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><summary className="cursor-pointer font-bold text-slate-600 dark:text-slate-300">Tipos de ruptura (A–F · NBR 5739)</summary><ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{RUPTURA_AF.map(([k, v]) => <li key={k}><span className="font-black">{k}</span> — {v}</li>)}</ul></details> : null}
      {cpsQ.isLoading ? <LoadingState /> : cpsQ.isError ? <ErrorState message={(cpsQ.error as Error).message} /> : filtradas.length === 0 ? <EmptyState /> : (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">Dica: cole uma coluna do Excel no campo de {entrarCarga ? 'carga' : 'MPa'} para preencher vários CPs de uma vez (Ctrl+V).</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2"><input type="checkbox" aria-label="Selecionar todos" checked={filtradas.length > 0 && selecionados.size === filtradas.length} onChange={toggleTodos} /></th>
                  <th className="px-3 py-2">Numeração</th><th className="px-3 py-2">Data prevista</th><th className="px-3 py-2">Data realizado</th><th className="px-3 py-2">{entrarCarga ? `Carga (${cargaUnidade})` : 'Resultado (MPa)'}</th><th className="px-3 py-2">Esperado (MPa)</th><th className="px-3 py-2">Nota fiscal</th><th className="px-3 py-2">Idade controle</th>{campoPrensa ? <th className="px-3 py-2">Prensa</th> : null}{campoTipo ? <th className="px-3 py-2">Ruptura</th> : null}{campoMassa ? <th className="px-3 py-2">Massa (g)</th> : null}<th className="px-3 py-2">Descartar</th><th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((r, localIdx) => {
                  const rowIdx = pageStart + localIdx;
                  const res = resultadoAtual(r);
                  const esp = esperado(r);
                  const naIdadeControle = isIdadeControle(r);
                  const abaixoFck = res?.resultado_valor != null && esp != null && res.resultado_valor < esp;
                  const ins = abaixoFck && naIdadeControle;
                  return (
                    <tr key={r.id} className={ins ? 'bg-red-50/70 dark:bg-red-950/20' : ''}>
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Selecionar CP ${cpNumero(r)}`} checked={selecionados.has(r.id)} onChange={() => toggleSelecionado(r.id)} /></td>
                      <td className="px-3 py-2 align-top"><div className="font-black text-slate-950 dark:text-slate-50">{cpNumero(r)}</div>{campoNumeracao ? <button type="button" className="text-xs font-bold text-blue-600" onClick={() => { setNumCp(r); setNumValor(r.numeracao_lab ?? ''); }}>{r.numeracao_lab ? 'editar numeração' : '+ numeração lab'}</button> : null}<div className="mt-1 text-[11px] text-slate-400">{statusBadge(r)}</div></td>
                      <td className="px-3 py-2 align-top"><span className={isAtrasado(r, dataRef) ? 'font-black text-red-600' : 'font-black'}>{fmtDate(r.data_prevista_rompimento)}{isAtrasado(r, dataRef) ? ' !' : ''}</span></td>
                      <td className="px-3 py-2"><div className="flex gap-2"><input className="input" type="date" value={effectiveData(r)} onChange={(e) => patch(r.id, { data: e.target.value })} /><input className="input max-w-[90px]" type="time" value={effectiveHora(r)} onChange={(e) => patch(r.id, { hora: e.target.value })} /></div></td>
                      <td className="px-3 py-2"><input id={`romp-val-${rowIdx}`} className="input max-w-[150px]" placeholder={entrarCarga ? 'carga' : 'MPa'} value={entrarCarga ? effectiveCarga(r) : effectiveValor(r)} onChange={(e) => patch(r.id, entrarCarga ? { carga: sanitizeDecimal(e.target.value, 2) } : { valor: sanitizeDecimal(e.target.value, 2) })} onPaste={(e) => handlePaste(e, rowIdx)} title="Cole uma coluna do Excel para preencher vários CPs · Enter pula para o próximo" onKeyDown={(e) => { if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); const n = document.getElementById(`romp-val-${rowIdx + 1}`) as HTMLInputElement | null; n?.focus(); n?.select(); } else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); const pv = document.getElementById(`romp-val-${rowIdx - 1}`) as HTMLInputElement | null; pv?.focus(); pv?.select(); } }} />{entrarCarga && effectiveCarga(r) ? <div className="mt-1 text-xs font-bold text-slate-500">≈ {nfmt(cargaParaMpa(Number(effectiveCarga(r)), cargaUnidade, diametro, altura), 1)} MPa · h/d {nfmt(relacaoHD(diametro, altura), 2)}</div> : null}{(() => { const mpa = entrarCarga ? cargaParaMpa(Number(effectiveCarga(r)), cargaUnidade, diametro, altura) : Number(effectiveValor(r)); return (effectiveValor(r) || effectiveCarga(r)) && mpaForaFaixa(mpa) ? <div className="mt-1 text-xs font-bold text-amber-600">⚠ MPa fora de faixa plausível (verifique a digitação)</div> : null; })()}{(() => { const mpa = entrarCarga ? cargaParaMpa(Number(effectiveCarga(r)), cargaUnidade, diametro, altura) : Number(effectiveValor(r)); const esp2 = esperado(r); return (effectiveValor(r) || effectiveCarga(r)) && Number.isFinite(mpa) && mpa > 0 && esp2 != null && esp2 > 0 && mpa < 0.8 * esp2 ? <div className="mt-1 text-xs font-bold text-red-600">⚠ Resultado 80% menor que o esperado</div> : null; })()}</td>
                      <td className="px-3 py-2"><span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">{esp == null ? 'sem critério' : nfmt(esp, 1)}</span>{ins ? <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">abaixo do fck</span> : abaixoFck ? <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">acompanhamento</span> : null}{(() => { const dp = dispDe(r); return dp != null && dp > dispLimite ? <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800" title={`Dispersão do par ${nfmt(dp, 1)}% acima do limite ${dispLimite}% — verifique moldagem, capeamento ou prensa (NBR 5739)`}>Δ {nfmt(dp, 1)}%</span> : null; })()}</td>
                      <td className="px-3 py-2 font-semibold">{nf(r)}{r.concretagens?.numero_relatorio ? <div className="text-[11px] font-normal text-slate-400">Rel. {r.concretagens.numero_relatorio}</div> : null}</td><td className="px-3 py-2 font-semibold">{idade(r)}</td>
                      {campoPrensa ? <td className="px-3 py-2 text-xs">{(() => { const eq = res?.equipamento_id ?? null; if (eq) return equipById.get(eq) ?? '—'; const al = prensasDaObra(r); if (al.length === 1) return <span className="text-slate-500" title="Prensa prevista pela alocação da obra">{equipById.get(al[0]) ?? '—'} <span className="text-slate-400">(prev.)</span></span>; if (al.length > 1) return <span className="text-slate-500" title="Várias prensas alocadas à obra">{al.length} prensas</span>; return <span className="text-slate-400">—</span>; })()}</td> : null}
                      {campoTipo ? <td className="px-3 py-2"><select className="input min-w-[82px]" value={effectiveTipo(r)} onChange={(e) => patch(r.id, { tipo_ruptura: e.target.value })}><option value="">-</option>{['A', 'B', 'C', 'D', 'E', 'F'].map((x) => <option key={x} value={x}>{x}</option>)}</select></td> : null}
                      {campoMassa ? <td className="px-3 py-2"><input className="input max-w-[110px]" type="number" inputMode="numeric" min={0} max={99999} step="1" value={effectiveMassa(r)} onChange={(e) => patch(r.id, { massa_cp_g: e.target.value })} onBlur={(e) => patch(r.id, { massa_cp_g: clampNum(e.target.value, { min: 0, max: 99999, dec: 0 })?.toString() ?? '' })} /></td> : null}
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Descartar CP ${cpNumero(r)}`} checked={r.situacao === 'descartado'} onChange={(e) => void alterarSituacao(r, e.target.checked ? 'descartado' : 'pendente')} /></td>
                      <td className="px-3 py-2"><div className="flex flex-wrap gap-2"><button type="button" className="font-bold text-blue-700" onClick={() => setCurvaCp(r)}>Curva</button>{(r.situacao === 'falhou' || r.situacao === 'ausente') ? <button type="button" className="font-bold text-emerald-700" onClick={() => void alterarSituacao(r, 'pendente')}>Reativar</button> : <><button type="button" className="font-bold text-blue-700" onClick={() => void alterarSituacaoConfirm(r, 'falhou')}>Falha</button><button type="button" className="font-bold text-blue-700" onClick={() => void alterarSituacaoConfirm(r, 'ausente')}>Ausente</button></>}<button type="button" className="font-bold text-blue-700" onClick={() => void abrirAudit(r)}>Trilha</button><button type="button" className="font-bold text-blue-700" onClick={() => void contraprovaConfirm(r)}>Contraprova</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="secondary" disabled={pageSafe <= 0} onClick={() => setPage(pageSafe - 1)}>Anterior</Button>
          <span className="font-bold text-slate-600 dark:text-slate-300">Página {pageSafe + 1} de {totalPages} · {filtradas.length} CP(s)</span>
          <Button variant="secondary" disabled={pageSafe >= totalPages - 1} onClick={() => setPage(pageSafe + 1)}>Próxima</Button>
        </div>
      ) : null}

      <Modal open={!!curvaCp} wide title={'Curva / exemplar - ' + (curvaCp ? cpNumero(curvaCp) : '')} onClose={() => setCurvaCp(null)}>
        <div className="space-y-3 text-sm"><p className="text-slate-600 dark:text-slate-300">CPs do mesmo exemplar/amostra, para conferir evolução por idade.</p><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-xs uppercase text-slate-500"><th>CP</th><th>Idade</th><th>Data</th><th>Resultado</th><th>Esperado</th></tr></thead><tbody>{curvaRows.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="py-2 font-bold">{cpNumero(r)}</td><td>{idade(r)}</td><td>{fmtDate(resultadoAtual(r)?.data_rompimento ?? r.data_prevista_rompimento)}</td><td>{nfmt(resultadoAtual(r)?.resultado_valor ?? null, 1)}</td><td>{nfmt(esperado(r), 1)}</td></tr>)}</tbody></table></div></div>
      </Modal>

      <Modal open={!!auditCp} wide title={'Trilha de alterações - ' + (auditCp ? cpNumero(auditCp) : '')} onClose={() => setAuditCp(null)}>
        {auditItems.length === 0 ? <p className="text-sm text-slate-500">Nenhuma alteração registrada para este CP.</p> : <TimelineList events={auditItems} hideOrigin />}
      </Modal>

      <Modal open={!!numCp} title="Numeração do laboratório" onClose={() => setNumCp(null)} footer={<><Button variant="ghost" onClick={() => setNumCp(null)}>Cancelar</Button><Button onClick={() => void salvarNumeracao()}>Salvar</Button></>}>
        <label className="block space-y-1"><span className="text-sm font-bold">Numeração lab</span><input className="input" value={numValor} onChange={(e) => setNumValor(e.target.value)} maxLength={25} /></label>
      </Modal>

      <Modal open={importOpen} wide title="Importar resultados" onClose={() => setImportOpen(false)} footer={<><Button variant="ghost" onClick={() => setImportOpen(false)}>Cancelar</Button><Button onClick={() => void aplicarImportacao()} disabled={busy || !importLines.some((l) => l.ok)}>{busy ? 'Importando...' : 'Importar resultados'}</Button></>}>
        <div className="space-y-4"><FilePicker label="Escolher planilha" accept=".xlsx,.xls,.csv" onFiles={(fs) => importarArquivo(fs[0] ?? null)} /><div className="rounded-xl border border-dashed border-slate-200 p-2 dark:border-slate-700"><div className="block space-y-1"><span className="text-sm font-bold">Ou leia a foto da agenda preenchida à caneta (OCR)</span><FilePicker label={lendoAgenda ? 'Lendo…' : 'Escolher foto da agenda'} accept="image/*" disabled={lendoAgenda} resetAfter onFiles={(fs) => importarAgendaFoto(fs[0] ?? null)} /></div><p className="mt-1 text-xs text-slate-500">Imprima a agenda (botão Agenda PDF), rompa e anote data/hora e MPa à caneta; o OCR casa o CP pela numeração impressa e traz os valores para conferência. Revise antes de importar.</p></div>{campoPrensa && prensas.length > 0 ? <label className="block space-y-1"><span className="text-sm font-bold">Prensa destas leituras</span><select className="input max-w-xs" value={prensaId} onChange={(e) => setPrensaId(e.target.value)}><option value="">Manter a já registrada (se houver)</option>{prensas.map((p) => <option key={p.id} value={p.id}>{rotuloEquip(p)}</option>)}</select></label> : null}{importLines.length ? <div className="max-h-80 overflow-auto rounded-xl border border-slate-200"><table className="w-full text-left text-xs"><thead><tr className="bg-slate-50"><th className="p-2">Linha</th><th>CP</th><th>Resultado</th><th>Data</th><th>Conf.</th><th>Status</th></tr></thead><tbody>{importLines.map((l) => <tr key={l.key} className="border-t"><td className="p-2">{l.key}</td><td>{l.numero || l.cp?.codigo}</td><td>{l.resultado}</td><td>{l.data}</td><td className={l.conf != null && l.conf < 0.6 ? 'font-bold text-amber-600' : 'text-slate-500'}>{l.conf != null ? Math.round(l.conf * 100) + '%' : '—'}</td><td className={l.ok ? 'text-green-700' : 'text-red-700'}>{l.msg}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">Use o modelo exportado pela tela. Colunas aceitas: corpo_prova_id, numeração/código, resultado_mpa <span className="italic">ou</span> carga + unidade_carga, massa_cp_g, data_rompimento, hora_rompimento, tipo_ruptura.</p>}</div>
      </Modal>
    </section>
  );
}
