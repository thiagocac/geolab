import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { NumField } from '../../components/ui/NumField';
import { sanitizeDigits } from '../../lib/validacao';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { MoldingStandardEditor } from '../../components/domain/MoldingStandardEditor';
import { FornecedorDatalist, FORNECEDORES_DL } from '../../components/domain/FornecedorDatalist';
import { FilePicker } from '../../components/ui/FilePicker';
import { getConcretagem, listCaminhoes, listCpsDaConcretagem, addCaminhao, invokeFicha, updateConcretagem, listTracosComFck, padraoMoldagemDaConcretagem, lerNfImagem, uploadEvidencia, listEvidencias, signedEvidencia, excluirEvidencia, lerFichaImagem, type ConcretagemRow, type FichaCaminhaoOCR } from '../../lib/api/concretagem';
import { TracoOptions } from '../../components/TracoOptions';
import { TimelineList } from '../../components/TimelineList';
import { listConcretagemTimeline, listWorkTimeline } from '../../lib/api/timeline';
import { getConfigLab } from '../../lib/api/preferencias';
import { filtrarPorFuncao, listColaboradoresRef } from '../../lib/api/colaboradores';
import { listEstruturas } from '../../lib/api/estruturaObra';
import { EstruturaPecaSelect } from '../../components/domain/EstruturaPecaSelect';
import { CAMPOS_CONCRETAGEM, CAMPOS_RECEBIMENTO, initCampoState } from '../../lib/concreto/camposEnsaioLaudo';
import { bumpNumeracao, normalizePadroes, padroesToDb, toNumber, type PadraoMoldagem } from '../../lib/concreto';

import { openDeferredTab, saveBlob as dl } from '../../lib/pdf';
import { etiquetasCpPdfUrl, numerarCps } from '../../lib/api/etiquetas';
const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => toNumber(v as number | string | null | undefined);
const val = (v: unknown) => v == null ? '' : String(v);
const dateBr = (iso?: string | null) => { if (!iso) return '-'; const [y, m, d] = iso.slice(0, 10).split('-'); return d && m && y ? `${d}/${m}/${y}` : iso; };

// Linha editável da conferência do OCR da ficha (valores como texto p/ edição livre).
type FichaRowEdit = { criar: boolean; serie: string; nota_fiscal: string; volume_m3: string; slump_medido_mm: string; hora_moldagem: string; hora_saida_usina: string; hora_chegada_obra: string; hora_inicio_descarga: string; hora_fim_descarga: string; elementos_concretados: string; qtde_cps: string; conf: number | null };
// Normaliza horário manuscrito lido por OCR ("8:5", "08h30", "8.30") -> "HH:MM"; inválido -> null.
const hhmmNorm = (v: unknown): string | null => { const t = String(v ?? '').trim(); if (!t) return null; const m = /^(\d{1,2})\s*[:hH.,]?\s*(\d{2})$/.exec(t); if (!m) return null; const h = Math.min(23, Number(m[1])); return String(h).padStart(2, '0') + ':' + m[2]; };

function payloadConcretagem(f: Record<string, unknown>, padrao: PadraoMoldagem[], c: ConcretagemRow): Record<string, unknown> {
  const md = (c.metadata && typeof c.metadata === 'object') ? c.metadata : {};
  return {
    operational_material_id: str(f.operational_material_id) || null,
    traco_texto: str(f.traco_texto) || null,
    fck_previsto: num(f.fck_previsto),
    fornecedor_texto: str(f.fornecedor_texto) || null,
    data_programada: str(f.data_programada) || null,
    hora_programada: str(f.hora_programada) || null,
    data_real: str(f.data_real) || null,
    hora_inicio: str(f.hora_inicio) || null,
    hora_fim: str(f.hora_fim) || null,
    local_texto: str(f.local_texto) || null,
    volume_programado_m3: num(f.volume_programado_m3),
    dimensao_cp: str(f.dimensao_cp) || '100x200',
    moldador_id: str(f.moldador_id) || null,
    clima: str(f.clima) || null,
    temperatura_ambiente_c: num(f.temperatura_ambiente_c),
    bombeado: f.bombeado === true,
    observacoes: str(f.observacoes) || null,
    metadata: { ...md, padrao_moldagem: padroesToDb(padrao) },
  };
}

function camposDefault(cat: typeof CAMPOS_CONCRETAGEM, cfg: Record<string, boolean> | null | undefined) { return initCampoState(cat, cfg); }

export function ConcretagemDetalhePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [padrao, setPadrao] = useState<PadraoMoldagem[]>([]);
  const [open, setOpen] = useState(false);
  const [camForm, setCamForm] = useState<Record<string, unknown>>({});
  const [lendoNf, setLendoNf] = useState(false);
  const [camPadrao, setCamPadrao] = useState<PadraoMoldagem[]>([]);
  const [numeracaoMap, setNumeracaoMap] = useState<Record<string, string>>({});
  const [primeiroNum, setPrimeiroNum] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState(false);
  const [upEvi, setUpEvi] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [lendoFicha, setLendoFicha] = useState(false);
  const [gravandoFicha, setGravandoFicha] = useState(false);
  const [fichaRows, setFichaRows] = useState<FichaRowEdit[]>([]);
  const [fichaConf, setFichaConf] = useState<number | null>(null);
  const [fichaFile, setFichaFile] = useState<File | null>(null);
  const [fichaEvid, setFichaEvid] = useState(true);

  const conc = useQuery({ queryKey: ['concretagem', id], queryFn: () => getConcretagem(id), enabled: !!id });
  const cams = useQuery({ queryKey: ['caminhoes', id], queryFn: () => listCaminhoes(id), enabled: !!id });
  const cps = useQuery({ queryKey: ['cps', id], queryFn: () => listCpsDaConcretagem(id), enabled: !!id });
  const evidencias = useQuery({ queryKey: ['evidencias', id], enabled: !!id, queryFn: async () => {
    const linhas = await listEvidencias(id);
    return Promise.all(linhas.map(async (r) => ({ ...r, url: await signedEvidencia(r.path).catch(() => '') })));
  } });
  const tracos = useQuery({ queryKey: ['tracos-fck', conc.data?.work_id, conc.data?.client_id], queryFn: () => listTracosComFck(conc.data?.work_id ?? null, conc.data?.client_id ?? null), enabled: !!conc.data });
  const colabRef = useQuery({ queryKey: ['colaboradores-ref'], queryFn: listColaboradoresRef });
  const colaboradores = filtrarPorFuncao(colabRef.data ?? [], 'Moldador');
  const cfg = useQuery({ queryKey: ['config_concretagem_recebimento', member?.tenant_id ?? 'none'], enabled: !!member, queryFn: () => getConfigLab(member?.tenant_id ?? '') });
  const estruturas = useQuery({ queryKey: ['estruturas-conc-detail', conc.data?.work_id ?? 'none'], queryFn: () => listEstruturas(conc.data?.work_id ?? ''), enabled: !!conc.data?.work_id });
  const [tlScope, setTlScope] = useState<'concretagem' | 'obra'>('concretagem');
  const tl = useQuery({ queryKey: ['conc-timeline', id, tlScope, conc.data?.work_id ?? null], queryFn: () => { const w = conc.data?.work_id; return (tlScope === 'obra' && w) ? listWorkTimeline(w) : listConcretagemTimeline(id); }, enabled: !!conc.data });

  useEffect(() => {
    const c = conc.data;
    if (!c) return;
    setForm({
      operational_material_id: c.operational_material_id ?? '', traco_texto: c.traco_texto ?? '', fck_previsto: c.fck_previsto ?? '', fornecedor_texto: c.fornecedor_texto ?? '',
      data_programada: c.data_programada ?? '', hora_programada: c.hora_programada ?? '', data_real: c.data_real ?? c.data_programada ?? '', hora_inicio: c.hora_inicio ?? '', hora_fim: c.hora_fim ?? '',
      local_texto: c.local_texto ?? '', volume_programado_m3: c.volume_programado_m3 ?? '', volume_lancado_m3: c.volume_lancado_m3 ?? '', dimensao_cp: c.dimensao_cp ?? '100x200',
      moldador_id: c.moldador_id ?? '', clima: c.clima ?? '', temperatura_ambiente_c: c.temperatura_ambiente_c ?? '', bombeado: !!c.bombeado, observacoes: c.observacoes ?? '',
    });
    setPadrao(padraoMoldagemDaConcretagem(c));
  }, [conc.data?.id]);

  const cc = useMemo(() => camposDefault(CAMPOS_CONCRETAGEM, cfg.data?.concretagem_campos ?? null), [cfg.data?.concretagem_campos]);
  const rc = useMemo(() => initCampoState(CAMPOS_RECEBIMENTO, cfg.data?.recebimento_campos ?? null), [cfg.data?.recebimento_campos]);
  const onC = (k: string) => cc[k] !== false;
  const onR = (k: string) => rc[k] !== false;
  const selectedTraco = (tracos.data ?? []).find((t) => t.value === form.operational_material_id);
  const fckAtual = num(form.fck_previsto) ?? selectedTraco?.fck ?? conc.data?.fck_previsto ?? null;
  // Numeração manual de CP (v132): expande os CPs na MESMA ordem em que addCaminhao os cria
  // (padroesToDb -> qtd por linha). slot.idx = índice de criação; ordenamos por idade só na exibição.
  // Padrão de moldagem vigente (da concretagem > traço): informa e valida a criação em lote do OCR.
  const padraoConc = useMemo(() => {
    const c0 = conc.data; if (!c0) return { txt: '', total: 0 };
    const dbp = padroesToDb(padraoMoldagemDaConcretagem(c0));
    let total = 0; const parts: string[] = [];
    for (const it of dbp) { const q = Number(it.quantidade) || 0; total += q; parts.push(q + '\u00d7' + String(it.idade) + (String(it.unidade) === 'hora' ? 'h' : 'd')); }
    return { txt: parts.join('  '), total };
  }, [conc.data]);
  const numSlots = useMemo(() => {
    const dbPad = padroesToDb(normalizePadroes(camPadrao, fckAtual));
    const slots: { key: string; idx: number; ageHours: number; ageLabel: string }[] = [];
    let idx = 0;
    for (const r of dbPad) {
      const idade = Number(r.idade) || 0;
      const unidade = String(r.unidade) === 'hora' ? 'hora' : 'dia';
      const qtd = Number(r.quantidade) || 0;
      const ageHours = unidade === 'hora' ? idade : idade * 24;
      const ageLabel = String(idade) + (unidade === 'hora' ? 'h' : 'd');
      for (let i = 0; i < qtd; i++) { slots.push({ key: String(r.id) + '-' + i, idx, ageHours, ageLabel }); idx++; }
    }
    return slots;
  }, [camPadrao, fckAtual]);
  const numSlotsSorted = useMemo(() => [...numSlots].sort((a, b) => a.ageHours - b.ageHours || a.idx - b.idx), [numSlots]);

  function patch(k: string, v: unknown) { setForm((s) => ({ ...s, [k]: v })); }
  function patchCam(k: string, v: unknown) { setCamForm((s) => ({ ...s, [k]: v })); }
  async function lerNf(file: File) {
    setLendoNf(true);
    try {
      const r = await lerNfImagem(file);
      if (!r.enabled) { toast(r.reason ?? 'Leitura por IA indisponivel.', 'error'); return; }
      const keys = Object.keys(r.dados);
      if (!keys.length) { toast('Nada legivel na imagem da NF.', 'error'); return; }
      setCamForm((s) => ({ ...s, ...r.dados }));
      toast('NF lida: ' + keys.length + ' campo(s) preenchido(s). Confira antes de salvar.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setLendoNf(false); }
  }
  function carregarPadraoTraco() {
    const t = (tracos.data ?? []).find((x) => x.value === form.operational_material_id);
    if (!t) { toast('Selecione um traço cadastrado ou mantenha o padrão manual da concretagem.', 'warning'); return; }
    setPadrao(normalizePadroes(t.padrao_moldagem ?? [], t.fck));
    if (t.fck != null) patch('fck_previsto', t.fck);
    toast('Padrão de moldagem do traço carregado.', 'success');
  }
  function abrirCaminhao() {
    const p = padrao.length ? padrao : padraoMoldagemDaConcretagem(conc.data);
    setCamPadrao(p);
    setCamForm({ nota_fiscal: '', houve_adicao_agua: false, rejeitado: false });
    setNumeracaoMap({});
    setPrimeiroNum('');
    setOpen(true);
  }
  function aplicarSeq(first: string) {
    const t = first.trim();
    if (!t || !numSlotsSorted.length) { setNumeracaoMap({}); return; }
    const next: Record<string, string> = {};
    numSlotsSorted.forEach((sl, j) => { next[sl.key] = bumpNumeracao(t, j); });
    setNumeracaoMap(next);
  }
  function gerarNumeracao() {
    const first = primeiroNum.trim();
    if (!first) { toast('Informe a numeração do 1º CP (o de menor idade).', 'warning'); return; }
    if (!numSlotsSorted.length) { toast('Defina as idades e quantidades dos CPs primeiro.', 'warning'); return; }
    aplicarSeq(first);
  }
  function buscarPadraoCaminhao() {
    const c = conc.data;
    const p = padrao.length ? padrao : padraoMoldagemDaConcretagem(c);
    setCamPadrao(p);
    toast('Padrão de moldagem carregado para este caminhão.', 'success');
  }
  async function salvarStep1() {
    const c = conc.data;
    if (!c) return;
    setBusyStep(true);
    try {
      await updateConcretagem(c.id, payloadConcretagem(form, padrao, c));
      await qc.invalidateQueries({ queryKey: ['concretagem', id] });
      await qc.invalidateQueries({ queryKey: ['concretagens'] });
      await qc.invalidateQueries({ queryKey: ['programacoes'] });
      toast('Dados da concretagem salvos.', 'success');
      setStep(2);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusyStep(false); }
  }
  async function salvarCaminhao() {
    const c = conc.data;
    if (!member || !c) return;
    setBusy(true);
    try {
      if (!str(camForm.nota_fiscal)) throw new Error('Nota fiscal é obrigatória.');
      const serie = (cams.data?.length ?? 0) + 1;
      const numeracoes = numSlots.map((sl) => numeracaoMap[sl.key] ?? null);
      await addCaminhao(member.tenant_id, c, serie, { ...camForm, padrao_moldagem: camPadrao, numeracoes });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['caminhoes', id] }), qc.invalidateQueries({ queryKey: ['cps', id] }), qc.invalidateQueries({ queryKey: ['rompimentos'] }), qc.invalidateQueries({ queryKey: ['concretagem', id] }),
      ]);
      toast('Caminhão, amostra e CPs adicionados.', 'success');
      setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function ficha() { try { dl(await invokeFicha(id), 'ficha-moldagem-' + (conc.data?.codigo ?? id.slice(0, 6)) + '.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }
  const [busyEtq, setBusyEtq] = useState(false);
  async function etiquetas(layout: 'rolo' | 'a4') {
    setBusyEtq(true);
    const tab = openDeferredTab('Gerando etiquetas…');
    try {
      await numerarCps(id); // idempotente: só preenche CPs sem numeração (NNNN/AA, lab+ano)
      tab.set(await etiquetasCpPdfUrl(id, layout));
    } catch (e) { tab.fail(); toast((e as Error).message, 'error'); }
    finally { setBusyEtq(false); }
  }
  async function onUploadEvidencia(file: File | null) {
    if (!file || !member) return;
    setUpEvi(true);
    try { await uploadEvidencia(member.tenant_id, id, file); await qc.invalidateQueries({ queryKey: ['evidencias', id] }); toast('Evidência enviada.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setUpEvi(false); }
  }
  async function onExcluirEvidencia(eid: string) {
    try { await excluirEvidencia(eid); await qc.invalidateQueries({ queryKey: ['evidencias', id] }); toast('Evidência removida.', 'info'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function onLerFicha(file: File) {
    setLendoFicha(true);
    try {
      const r = await lerFichaImagem(file, id);
      if (!r.enabled) { toast(r.reason ?? 'Leitura por IA indisponível.', 'error'); setFichaRows([]); return; }
      const existentes = new Set((cams.data ?? []).map((x) => str(x.nota_fiscal)).filter(Boolean));
      const rows: FichaRowEdit[] = (r.caminhoes as FichaCaminhaoOCR[]).map((cv) => {
        const nf = str(cv.nota_fiscal);
        return {
          criar: !!nf && !existentes.has(nf),
          serie: cv.serie != null ? String(cv.serie) : '',
          nota_fiscal: nf,
          volume_m3: cv.volume_m3 != null ? String(cv.volume_m3) : '',
          slump_medido_mm: cv.slump_medido_mm != null ? String(cv.slump_medido_mm) : '',
          hora_moldagem: str(cv.hora_moldagem), hora_saida_usina: str(cv.hora_saida_usina), hora_chegada_obra: str(cv.hora_chegada_obra), hora_inicio_descarga: str(cv.hora_inicio_descarga), hora_fim_descarga: str(cv.hora_fim_descarga),
          elementos_concretados: str(cv.elementos_concretados), qtde_cps: cv.qtde_cps != null ? String(cv.qtde_cps) : '', conf: cv.conf ?? null,
        };
      });
      setFichaRows(rows); setFichaConf(r.confianca); setFichaFile(file);
      if (!rows.length) toast(r.reason ? 'Nenhum caminhão detectado (' + r.reason + ').' : 'Nenhum caminhão detectado na imagem. Tente uma foto mais nítida, de frente.', 'warning');
      else toast(rows.length + ' caminhão(ões) detectado(s). Confira, ajuste e escolha o que criar.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setLendoFicha(false); }
  }
  function setFichaRow(i: number, patchRow: Partial<FichaRowEdit>) { setFichaRows((s0) => s0.map((r, idx) => (idx === i ? { ...r, ...patchRow } : r))); }
  async function onCriarDetectados() {
    const c = conc.data; if (!member || !c) return;
    const marcadas = fichaRows.filter((r) => r.criar && str(r.nota_fiscal));
    if (!marcadas.length) { toast('Marque ao menos uma linha (com NF) para criar.', 'warning'); return; }
    setGravandoFicha(true);
    try {
      const existentesNf = new Set((cams.data ?? []).map((x) => str(x.nota_fiscal)).filter(Boolean));
      const usadas = new Set((cams.data ?? []).map((x) => Number(x.serie) || 0));
      let criados = 0;
      for (const r of marcadas) {
        const nf = str(r.nota_fiscal);
        if (existentesNf.has(nf)) continue; // idempotência: NF já lançada nesta concretagem
        let serie = Number(r.serie) || 0;
        if (!serie || usadas.has(serie)) serie = (usadas.size ? Math.max(...usadas) : 0) + 1;
        usadas.add(serie); existentesNf.add(nf); criados += 1;
        await addCaminhao(member.tenant_id, c, serie, {
          nota_fiscal: nf,
          volume_m3: num(r.volume_m3),
          slump_medido_mm: num(r.slump_medido_mm),
          hora_moldagem: hhmmNorm(r.hora_moldagem),
          hora_saida_usina: hhmmNorm(r.hora_saida_usina),
          hora_chegada_obra: hhmmNorm(r.hora_chegada_obra),
          hora_inicio_descarga: hhmmNorm(r.hora_inicio_descarga),
          hora_fim_descarga: hhmmNorm(r.hora_fim_descarga),
          elementos_concretados: str(r.elementos_concretados) || null,
          external_key: 'ficha:' + nf,
        });
      }
      if (criados && fichaFile && fichaEvid) {
        try { await uploadEvidencia(member.tenant_id, id, fichaFile, { tipo: 'ficha', descricao: 'Ficha de moldagem lida por OCR (' + criados + ' caminhão(ões) criado(s))' }); await qc.invalidateQueries({ queryKey: ['evidencias', id] }); } catch { /* evidência é best-effort */ }
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['caminhoes', id] }), qc.invalidateQueries({ queryKey: ['cps', id] }), qc.invalidateQueries({ queryKey: ['concretagem', id] })]);
      toast(criados ? criados + ' caminhão(ões) criado(s), cada um com ' + padraoConc.total + ' CP(s) do padrão de moldagem.' : 'Nada novo a criar (NFs já lançadas).', criados ? 'success' : 'info');
      if (criados) { setFichaOpen(false); setFichaRows([]); setFichaFile(null); }
    } catch (e) { toast((e as Error).message, 'error'); } finally { setGravandoFicha(false); }
  }

  if (conc.isLoading) return <LoadingState />;
  if (conc.isError || !conc.data) return <ErrorState message={conc.error ? (conc.error as Error).message : 'Concretagem não encontrada'} />;
  const c = conc.data;
  const cpsRows = cps.data ?? [];
  const volumeTotal = (cams.data ?? []).reduce((s, r) => s + (Number(r.volume_m3) || 0), 0);

  return (
    <section className="space-y-4">
      <Button variant="ghost" onClick={() => nav('/concretagens')}>{'< Concretagens'}</Button>
      <PageHeader kicker="Concreto · atendimento" title={c.codigo ?? '(sem código)'} description={(c.lab_clients?.razao_social ?? '-') + ' · ' + (c.client_works?.nome ?? '-') + ' · ' + (c.status ?? 'rascunho')} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setStep(1)} className={'rounded-full px-3 py-1.5 text-sm font-black ' + (step === 1 ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}>1 · Concretagem</button>
        <button type="button" onClick={() => setStep(2)} className={'rounded-full px-3 py-1.5 text-sm font-black ' + (step === 2 ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}>2 · Caminhões + CPs</button>
        <div className="ml-auto flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void ficha()}>Gerar ficha PDF</Button><Button variant="secondary" disabled={busyEtq} onClick={() => void etiquetas('rolo')}>Etiquetas 60×40 (rolo)</Button><Button variant="secondary" disabled={busyEtq} onClick={() => void etiquetas('a4')}>Etiquetas A4</Button><Button variant="secondary" onClick={() => { setStep(2); setFichaRows([]); setFichaConf(null); setFichaFile(null); setFichaOpen(true); }}>Ler ficha preenchida (OCR)</Button><Button onClick={abrirCaminhao}>Adicionar caminhão</Button></div>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader title="Etapa 1 — Concretagem">Dados globais do atendimento. O padrão de moldagem daqui será usado quando o caminhão buscar o padrão da concretagem.</CardHeader>
          <div className="space-y-5 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Cliente" value={c.lab_clients?.razao_social ?? '-'} readOnly />
              <Field label="Obra" value={c.client_works?.nome ?? '-'} readOnly />
              <SelectField label="Traço cadastrado" value={val(form.operational_material_id)} onChange={(e) => { const idv = e.target.value; const t = (tracos.data ?? []).find((x) => x.value === idv); setForm((s) => ({ ...s, operational_material_id: idv, fck_previsto: t?.fck ?? s.fck_previsto, traco_texto: idv ? s.traco_texto : s.traco_texto })); if (t?.padrao_moldagem?.length) setPadrao(normalizePadroes(t.padrao_moldagem, t.fck)); }}><option value="">Manual / texto livre</option><TracoOptions tracos={tracos.data ?? []} workId={conc.data?.work_id ?? null} clientId={conc.data?.client_id ?? null} /></SelectField>
              {conc.data?.work_id ? <button type="button" className="justify-self-start text-xs font-bold text-blue-600" onClick={() => nav('/tracos?work=' + String(conc.data?.work_id))}>Gerenciar traços desta obra</button> : null}
              {!form.operational_material_id ? <Field label="Traço / descrição manual" value={val(form.traco_texto)} onChange={(e) => patch('traco_texto', e.target.value)} /> : null}
              <NumField label="FCK previsto (MPa)" value={num(form.fck_previsto)} onCommit={(n) => patch('fck_previsto', n)} min={1} max={150} soft={[10, 100]} />
              {onC('fornecedor') ? <><Field label="Fornecedor / central" list={FORNECEDORES_DL} value={val(form.fornecedor_texto)} onChange={(e) => patch('fornecedor_texto', e.target.value)} /><FornecedorDatalist /></> : null}
              {onC('data_hora') ? <><Field label="Data programada" type="date" value={val(form.data_programada)} onChange={(e) => patch('data_programada', e.target.value)} /><Field label="Hora programada" type="time" value={val(form.hora_programada)} onChange={(e) => patch('hora_programada', e.target.value)} /><Field label="Data real" type="date" value={val(form.data_real)} onChange={(e) => patch('data_real', e.target.value)} /><Field label="Início real" type="time" value={val(form.hora_inicio)} onChange={(e) => patch('hora_inicio', e.target.value)} /><Field label="Fim real" type="time" value={val(form.hora_fim)} onChange={(e) => patch('hora_fim', e.target.value)} /></> : null}
              {onC('local_peca') && (estruturas.data ?? []).length ? <EstruturaPecaSelect estruturas={estruturas.data ?? []} initialLocal={val(form.local_texto)} onPick={(v) => patch('local_texto', v.local)} /> : null}
              {onC('local_peca') ? <Field label="Local / peça" value={val(form.local_texto)} onChange={(e) => patch('local_texto', e.target.value)} /> : null}
              {onC('volume_programado') ? <><NumField label="Volume programado (m³)" value={num(form.volume_programado_m3)} onCommit={(n) => patch('volume_programado_m3', n)} min={0} max={999} dec={2} soft={[0, 500]} /><Field label="Volume lançado (m³)" type="number" value={(cams.data ?? []).length ? String((cams.data ?? []).reduce((t, x) => t + (Number(x.volume_m3) || 0), 0)) : val(form.volume_lancado_m3)} disabled hint="Preenchido automaticamente: soma o volume de todos os caminhões lançados na Etapa 2. Para ajustar, edite o volume no próprio caminhão/NF." /></> : null}
              {onC('moldador') ? <SelectField label="Moldador" value={val(form.moldador_id)} onChange={(e) => patch('moldador_id', e.target.value)}><option value="">-</option>{colaboradores.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</SelectField> : null}
              {onC('dimensao_cp') ? <SelectField label="Dimensão CP" value={val(form.dimensao_cp)} onChange={(e) => patch('dimensao_cp', e.target.value)}><option value="100x200">100 x 200 mm</option><option value="150x300">150 x 300 mm</option><option value="100x100x400">100 x 100 x 400 mm</option><option value="150x150x500">150 x 150 x 500 mm</option></SelectField> : null}
              {onC('clima') ? <Field label="Clima" value={val(form.clima)} onChange={(e) => patch('clima', e.target.value)} /> : null}
              {onC('temperatura_ambiente') ? <NumField label="Temperatura ambiente (°C)" value={num(form.temperatura_ambiente_c)} onCommit={(n) => patch('temperatura_ambiente_c', n)} min={-5} max={55} dec={1} soft={[0, 45]} /> : null}
              {onC('bombeado') ? <label className="flex items-center gap-2 pt-7 text-sm font-bold"><input type="checkbox" checked={form.bombeado === true} onChange={(e) => patch('bombeado', e.target.checked)} /> Concreto bombeado / lançamento por bomba</label> : null}
            </div>
            {onC('observacoes') ? <TextArea label="Observações gerais" value={val(form.observacoes)} onChange={(e) => patch('observacoes', e.target.value)} /> : null}
            {onC('padrao_moldagem') ? <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-slate-950 dark:text-slate-50">Padrão de moldagem da concretagem</h3><p className="text-xs text-slate-500">Use quando o cadastro for manual ou quando quiser ajustar o padrão do traço para este atendimento.</p></div><Button variant="secondary" onClick={carregarPadraoTraco}>Buscar padrão do traço</Button></div><MoldingStandardEditor value={padrao} onChange={setPadrao} fck={fckAtual} /></div> : null}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><Button variant="ghost" onClick={() => nav('/concretagens')}>Voltar</Button><Button onClick={() => void salvarStep1()} disabled={busyStep}>{busyStep ? 'Salvando...' : 'Salvar e ir para caminhões'}</Button></div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="p-4"><div className="text-xs font-bold uppercase text-slate-500">Caminhões</div><div className="mt-1 text-2xl font-black">{cams.data?.length ?? 0}</div></Card>
            <Card className="p-4"><div className="text-xs font-bold uppercase text-slate-500">CPs gerados</div><div className="mt-1 text-2xl font-black">{cpsRows.length}</div></Card>
            <Card className="p-4"><div className="text-xs font-bold uppercase text-slate-500">Volume recebido</div><div className="mt-1 text-2xl font-black">{volumeTotal.toLocaleString('pt-BR')} m³</div></Card>
            <Card className="p-4"><div className="text-xs font-bold uppercase text-slate-500">Próxima ruptura</div><div className="mt-1 text-2xl font-black">{dateBr(cpsRows.find((cp) => cp.situacao === 'pendente')?.data_prevista_rompimento)}</div></Card>
          </div>
          {cams.isLoading ? <LoadingState /> : (cams.data?.length ?? 0) === 0 ? <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300"><b>Nenhum caminhão lançado.</b><br />Adicione o primeiro caminhão para gerar a amostra e os CPs pelo padrão de moldagem.</Card> : (
            <div className="space-y-3">
              {(cams.data ?? []).map((cam) => {
                const cpsCam = cpsRows.filter((cp) => cp.receipt_id === cam.id);
                return (
                  <Card key={cam.id} className="overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                      <div><div className="font-black text-slate-950 dark:text-slate-50">Caminhão {cam.serie ?? '-'} · NF {cam.nota_fiscal}</div><div className="mt-1 text-xs text-slate-500">{onR('placa') ? `Placa ${cam.placa ?? '-'} · ` : ''}{onR('volume_m3') ? `Volume ${cam.volume_m3 ?? '-'} m³ · ` : ''}{onR('slump') ? `Slump ${cam.slump_medido_mm ?? '-'} mm · ` : ''}{onR('temperatura_concreto') ? `Temp. ${cam.temperatura_concreto_c ?? '-'} °C` : ''}</div></div>
                      {cam.rejeitado ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Rejeitado</span> : <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">Recebido</span>}
                    </div>
                    <div className="grid gap-3 p-4 md:grid-cols-3">
                      {onR('horarios_transporte') ? <div className="text-sm"><b>Transporte:</b> {cam.hora_saida_usina ?? '-'} {'->'} {cam.hora_chegada_obra ?? '-'}</div> : null}
                      {onR('horarios_descarga') ? <div className="text-sm"><b>Descarga:</b> {cam.hora_inicio_descarga ?? '-'} {'->'} {cam.hora_fim_descarga ?? '-'}</div> : null}
                      {onR('hora_moldagem') ? <div className="text-sm"><b>Moldagem:</b> {cam.hora_moldagem ?? '-'}</div> : null}
                      {onR('agua_adicionada') ? <div className="text-sm"><b>Água:</b> {cam.houve_adicao_agua ? `${cam.agua_litros ?? '-'} L` : 'não'}</div> : null}
                      {onR('motorista') ? <div className="text-sm"><b>Motorista:</b> {cam.motorista ?? '-'}</div> : null}
                      {onR('elementos_concretados') ? <div className="text-sm md:col-span-2"><b>Elementos:</b> {cam.elementos_concretados ?? '-'}</div> : null}
                      {onR('observacoes_caminhao') ? <div className="text-sm md:col-span-3"><b>Obs.:</b> {cam.observacoes ?? '-'}</div> : null}
                    </div>
                    <div className="border-t border-slate-100 p-4 dark:border-slate-800"><div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Corpos de prova</div>{cpsCam.length ? <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{cpsCam.map((cp) => <div key={cp.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><b>{cp.codigo ?? cp.id.slice(0, 8)}</b>{cp.numeracao_lab ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Nº {cp.numeracao_lab}</span> : null}<span className="ml-2 text-slate-500">{cp.idade_dias ?? '-'} {cp.idade_unidade === 'hora' ? 'h' : 'd'} · {cp.situacao}</span>{cp.resultado != null ? <span className="ml-2 font-black text-green-700">{cp.resultado} MPa</span> : null}</div>)}</div> : <p className="text-sm text-slate-500">Sem CPs.</p>}</div>
                  </Card>
                );
              })}
            </div>
          )}

          <Card>
            <CardHeader kicker="Registro fotográfico" title="Evidências">Fotos do local, dos CPs ou da ficha física. Visíveis só para a equipe do laboratório.</CardHeader>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-bold">Adicionar foto:</span><FilePicker label="Escolher foto" accept="image/*" disabled={upEvi} resetAfter onFiles={(fs) => void onUploadEvidencia(fs[0] ?? null)} />{upEvi ? <span className="text-xs text-slate-500">enviando...</span> : null}</div>
              {evidencias.isLoading ? <p className="text-sm text-slate-500">Carregando...</p> : (evidencias.data?.length ?? 0) === 0 ? <p className="text-sm text-slate-500">Nenhuma evidência ainda.</p> : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {(evidencias.data ?? []).map((ev) => (
                    <div key={ev.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      {ev.url ? <a href={ev.url} target="_blank" rel="noreferrer"><img src={ev.url} alt={ev.descricao ?? 'evidência'} className="h-28 w-full object-cover" /></a> : <div className="flex h-28 items-center justify-center text-xs text-slate-400">indisponível</div>}
                      <div className="flex items-center justify-between gap-2 px-2 py-1 text-[11px]"><span className="truncate text-slate-500">{dateBr(ev.created_at)}</span><button type="button" className="font-bold text-red-600" onClick={() => void onExcluirEvidencia(ev.id)}>excluir</button></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <Modal open={open} wide title="Adicionar caminhão + CPs" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvarCaminhao()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar caminhão e gerar CPs'}</Button></>}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-bold">Ler NF (foto):</span><FilePicker label="Escolher foto" accept="image/*" disabled={lendoNf} resetAfter onFiles={(fs) => { if (fs[0]) void lerNf(fs[0]); }} />{lendoNf ? <span className="text-xs text-slate-500">lendo...</span> : null}</div>
            <p className="mt-1 text-xs text-slate-500">Fotografe a DANFE/nota do caminhão para preencher os campos. Requer VISION_API_KEY; confira antes de salvar.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nota fiscal" required inputMode="numeric" maxLength={15} value={val(camForm.nota_fiscal)} onChange={(e) => patchCam('nota_fiscal', sanitizeDigits(e.target.value, true))} />
            {onR('placa') ? <Field label="Placa" value={val(camForm.placa)} onChange={(e) => patchCam('placa', e.target.value)} /> : null}
            {onR('motorista') ? <Field label="Motorista" value={val(camForm.motorista)} onChange={(e) => patchCam('motorista', e.target.value)} /> : null}
            {onR('volume_m3') ? <NumField label="Volume (m³)" value={num(camForm.volume_m3)} onCommit={(n) => patchCam('volume_m3', n)} min={0} max={20} dec={2} soft={[0, 12]} softMsg="Volume acima do usual para um caminhao (<= 12 m³)" /> : null}
            {onR('slump') ? <NumField label="Slump medido (mm)" value={num(camForm.slump_medido_mm)} onCommit={(n) => patchCam('slump_medido_mm', n)} min={0} max={990} soft={[0, 300]} /> : null}
            {onR('temperatura_concreto') ? <NumField label="Temperatura concreto (°C)" value={num(camForm.temperatura_concreto_c)} onCommit={(n) => patchCam('temperatura_concreto_c', n)} min={0} max={60} dec={1} soft={[5, 40]} /> : null}
            {onR('horarios_transporte') ? <><Field label="Saída da usina" type="time" value={val(camForm.hora_saida_usina)} onChange={(e) => patchCam('hora_saida_usina', e.target.value)} /><Field label="Chegada à obra" type="time" value={val(camForm.hora_chegada_obra)} onChange={(e) => patchCam('hora_chegada_obra', e.target.value)} /></> : null}
            {onR('horarios_descarga') ? <><Field label="Início descarga" type="time" value={val(camForm.hora_inicio_descarga)} onChange={(e) => patchCam('hora_inicio_descarga', e.target.value)} /><Field label="Fim descarga" type="time" value={val(camForm.hora_fim_descarga)} onChange={(e) => patchCam('hora_fim_descarga', e.target.value)} /></> : null}
            {onR('hora_moldagem') ? <Field label="Hora moldagem" type="time" value={val(camForm.hora_moldagem)} onChange={(e) => patchCam('hora_moldagem', e.target.value)} /> : null}
            {onR('agua_adicionada') ? <><label className="flex items-center gap-2 pt-7 text-sm font-bold"><input type="checkbox" checked={camForm.houve_adicao_agua === true} onChange={(e) => patchCam('houve_adicao_agua', e.target.checked)} /> Houve adição de água</label><NumField label="Água adicionada (L)" value={num(camForm.agua_litros)} onCommit={(n) => patchCam('agua_litros', n)} min={0} max={999} dec={1} soft={[0, 100]} /></> : null}
            {onR('rejeicao') ? <><label className="flex items-center gap-2 pt-7 text-sm font-bold"><input type="checkbox" checked={camForm.rejeitado === true} onChange={(e) => patchCam('rejeitado', e.target.checked)} /> Caminhão rejeitado</label><Field label="Motivo rejeição" value={val(camForm.motivo_rejeicao)} onChange={(e) => patchCam('motivo_rejeicao', e.target.value)} /></> : null}
          </div>
          {onR('elementos_concretados') ? <TextArea label="Elementos concretados" value={val(camForm.elementos_concretados)} onChange={(e) => patchCam('elementos_concretados', e.target.value)} /> : null}
          {onR('observacoes_caminhao') ? <TextArea label="Observações do caminhão" value={val(camForm.observacoes)} onChange={(e) => patchCam('observacoes', e.target.value)} /> : null}
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-slate-950 dark:text-slate-50">Amostra e CPs deste caminhão</h3><p className="text-xs text-slate-500">Ajuste idades e quantidades antes de salvar. O sistema gera os CPs automaticamente.</p></div><Button variant="secondary" onClick={buscarPadraoCaminhao}>Buscar padrão de moldagem</Button></div>
            <MoldingStandardEditor value={camPadrao} onChange={setCamPadrao} fck={fckAtual} />
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="font-black text-slate-950 dark:text-slate-50">Numeração dos corpos de prova</h3><p className="text-xs text-slate-500">Numeração interna do laboratório, gravada em cada CP. Digite o nº do 1º CP (o de menor idade) e o sistema preenche os demais em sequência — ajuste qualquer um se precisar.</p></div>
                <div className="flex items-end gap-2"><Field label="Nº do 1º CP" value={primeiroNum} onChange={(e) => { const v = e.target.value; setPrimeiroNum(v); aplicarSeq(v); }} /><Button variant="secondary" onClick={gerarNumeracao} disabled={!numSlotsSorted.length}>Gerar sequência</Button></div>
              </div>
              {numSlotsSorted.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-500 dark:border-slate-700">Defina as idades e quantidades acima para numerar os CPs.</p> : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {numSlotsSorted.map((sl, j) => (
                    <label key={sl.key} className="flex items-center gap-2 text-sm"><span className="w-16 shrink-0 text-xs font-bold text-slate-500">{j + 1} · {sl.ageLabel}</span><input className="input !min-h-9 w-full px-2 py-1" value={numeracaoMap[sl.key] ?? ''} onChange={(e) => { const v = e.target.value; setNumeracaoMap((prev) => ({ ...prev, [sl.key]: v })); }} aria-label={'Numeração do CP ' + (j + 1)} /></label>
                  ))}
                </div>
              )}
            </div>
        </div>
      </Modal>

      <Modal open={fichaOpen} wide title="Importar ficha de moldagem (OCR)" onClose={() => setFichaOpen(false)} footer={<><Button variant="ghost" onClick={() => setFichaOpen(false)}>Fechar</Button>{fichaRows.length ? <Button onClick={() => void onCriarDetectados()} disabled={gravandoFicha || !fichaRows.some((r) => r.criar && str(r.nota_fiscal))}>{gravandoFicha ? 'Criando...' : 'Criar ' + fichaRows.filter((r) => r.criar && str(r.nota_fiscal)).length + ' caminhão(ões) + CPs'}</Button> : null}</>}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-bold">Foto ou scan da ficha preenchida:</span><FilePicker label="Escolher imagem" accept="image/*" disabled={lendoFicha} resetAfter onFiles={(fs) => { if (fs[0]) void onLerFicha(fs[0]); }} />{lendoFicha ? <span className="text-xs text-slate-500">lendo…</span> : null}</div>
            <p className="mt-1 text-xs text-slate-500">A IA lê a grade manuscrita (uma linha por caminhão) e monta a conferência abaixo. Nada é gravado antes de você confirmar — edite qualquer campo que o OCR tiver errado.</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">Cada caminhão criado gera <b>{padraoConc.total} CP(s)</b> pelo padrão de moldagem da concretagem/traço{padraoConc.txt ? <> ({padraoConc.txt})</> : null}. Se precisar de outro padrão, ajuste na etapa 1 antes de importar.</div>
          {fichaConf != null ? <div className="text-xs text-slate-500">Legibilidade geral da ficha: <b>{Math.round((fichaConf ?? 0) * 100)}%</b></div> : null}
          {fichaRows.length === 0 ? <p className="text-sm text-slate-500">Nenhum caminhão detectado ainda.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-500"><th className="py-1 pr-2">Criar</th><th className="py-1 pr-2">Série</th><th className="py-1 pr-2">NF *</th><th className="py-1 pr-2">Vol. (m³)</th><th className="py-1 pr-2">Slump</th><th className="py-1 pr-2">Mold.</th><th className="py-1 pr-2">Saída usina</th><th className="py-1 pr-2">Chegada</th><th className="py-1 pr-2">Iní. desc.</th><th className="py-1 pr-2">Fim desc.</th><th className="py-1 pr-2">Elementos</th><th className="py-1 pr-2">Situação</th></tr></thead>
                <tbody>
                  {fichaRows.map((r, i) => {
                    const nf = str(r.nota_fiscal);
                    const jaExiste = !!nf && (cams.data ?? []).some((x) => str(x.nota_fiscal) === nf);
                    const qtdeFicha = num(r.qtde_cps);
                    const divergeQtde = qtdeFicha != null && padraoConc.total > 0 && qtdeFicha !== padraoConc.total;
                    const confBaixa = r.conf != null && r.conf < 0.7;
                    return (
                      <tr key={i} className={'border-t border-slate-100 align-top dark:border-slate-800 ' + (jaExiste ? 'opacity-50' : '')}>
                        <td className="py-1.5 pr-2"><input type="checkbox" checked={r.criar && !jaExiste && !!nf} disabled={jaExiste || !nf} onChange={(e) => setFichaRow(i, { criar: e.target.checked })} aria-label={'Criar caminhão ' + (i + 1)} /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-12 px-1 text-xs" value={r.serie} onChange={(e) => setFichaRow(i, { serie: e.target.value })} aria-label="Série" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-24 px-1 text-xs font-bold" value={r.nota_fiscal} onChange={(e) => setFichaRow(i, { nota_fiscal: e.target.value, criar: r.criar || !!e.target.value.trim() })} aria-label="Nota fiscal" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-16 px-1 text-xs" value={r.volume_m3} onChange={(e) => setFichaRow(i, { volume_m3: e.target.value })} aria-label="Volume" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-14 px-1 text-xs" value={r.slump_medido_mm} onChange={(e) => setFichaRow(i, { slump_medido_mm: e.target.value })} aria-label="Slump" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-16 px-1 text-xs" value={r.hora_moldagem} onChange={(e) => setFichaRow(i, { hora_moldagem: e.target.value })} placeholder="HH:MM" aria-label="Hora da moldagem" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-16 px-1 text-xs" value={r.hora_saida_usina} onChange={(e) => setFichaRow(i, { hora_saida_usina: e.target.value })} placeholder="HH:MM" aria-label="Saída da usina" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-16 px-1 text-xs" value={r.hora_chegada_obra} onChange={(e) => setFichaRow(i, { hora_chegada_obra: e.target.value })} placeholder="HH:MM" aria-label="Chegada à obra" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-16 px-1 text-xs" value={r.hora_inicio_descarga} onChange={(e) => setFichaRow(i, { hora_inicio_descarga: e.target.value })} placeholder="HH:MM" aria-label="Início da descarga" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-16 px-1 text-xs" value={r.hora_fim_descarga} onChange={(e) => setFichaRow(i, { hora_fim_descarga: e.target.value })} placeholder="HH:MM" aria-label="Fim da descarga" /></td>
                        <td className="py-1.5 pr-2"><input className="input h-7 w-36 px-1 text-xs" value={r.elementos_concretados} onChange={(e) => setFichaRow(i, { elementos_concretados: e.target.value })} aria-label="Elementos concretados" /></td>
                        <td className="py-1.5 pr-2 text-[11px] leading-4">
                          {jaExiste ? <span className="font-bold text-slate-400">já lançado</span> : !nf ? <span className="font-bold text-amber-600">sem NF — informe p/ criar</span> : <span className="font-bold text-green-700">novo</span>}
                          {divergeQtde ? <div className="font-bold text-amber-600">ficha: {qtdeFicha} CP ≠ padrão {padraoConc.total}</div> : null}
                          {confBaixa ? <div className="text-amber-600">legibilidade baixa — confira</div> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {fichaRows.length ? <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={fichaEvid} onChange={(e) => setFichaEvid(e.target.checked)} /> Salvar a foto da ficha como evidência desta concretagem</label> : null}
        </div>
      </Modal>
      <Card>
        <CardHeader kicker="Auditoria" title="Linha do tempo">Eventos e marcos auditáveis desta concretagem e da obra.</CardHeader>
        <div className="p-5 pt-0">
          <div className="mb-3 flex gap-1">
            <Button variant={tlScope === 'concretagem' ? 'primary' : 'ghost'} onClick={() => setTlScope('concretagem')}>Desta concretagem</Button>
            {c.work_id ? <Button variant={tlScope === 'obra' ? 'primary' : 'ghost'} onClick={() => setTlScope('obra')}>Desta obra</Button> : null}
          </div>
          {tl.isLoading ? <LoadingState /> : tl.error ? <ErrorState message={(tl.error as Error).message} /> : (tl.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Sem eventos ainda.</p> : <TimelineList events={tl.data ?? []} hideOrigin={tlScope === 'concretagem'} />}
          {c.work_id ? <div className="mt-3"><Button variant="secondary" onClick={() => nav('/gestao/timeline?scope=' + tlScope + '&id=' + (tlScope === 'obra' ? c.work_id : id))}>Abrir linha do tempo completa</Button></div> : null}
        </div>
      </Card>
    </section>
  );
}
