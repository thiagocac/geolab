import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { MoldingStandardEditor } from '../../components/domain/MoldingStandardEditor';
import { getConcretagem, listCaminhoes, listCpsDaConcretagem, addCaminhao, invokeFicha, updateConcretagem, listTracosComFck, padraoMoldagemDaConcretagem, lerNfImagem, uploadEvidencia, listEvidencias, signedEvidencia, excluirEvidencia, lerFichaImagem, type ConcretagemRow, type FichaCaminhaoOCR } from '../../lib/api/concretagem';
import { getConfigLab } from '../../lib/api/preferencias';
import { listColaboradores } from '../../lib/api/colaboradores';
import { listPecasObra } from '../../lib/api/estrutura';
import { CAMPOS_CONCRETAGEM, CAMPOS_RECEBIMENTO, initCampoState } from '../../lib/concreto/camposEnsaioLaudo';
import { normalizePadroes, padroesToDb, toNumber, type PadraoMoldagem } from '../../lib/concreto';

import { saveBlob as dl } from '../../lib/pdf';
const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => toNumber(v as number | string | null | undefined);
const val = (v: unknown) => v == null ? '' : String(v);
const dateBr = (iso?: string | null) => { if (!iso) return '-'; const [y, m, d] = iso.slice(0, 10).split('-'); return d && m && y ? `${d}/${m}/${y}` : iso; };

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
    volume_lancado_m3: num(f.volume_lancado_m3),
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
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState(false);
  const [upEvi, setUpEvi] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [lendoFicha, setLendoFicha] = useState(false);
  const [gravandoFicha, setGravandoFicha] = useState(false);
  const [fichaCams, setFichaCams] = useState<FichaCaminhaoOCR[]>([]);
  const [fichaConf, setFichaConf] = useState<number | null>(null);

  const conc = useQuery({ queryKey: ['concretagem', id], queryFn: () => getConcretagem(id), enabled: !!id });
  const cams = useQuery({ queryKey: ['caminhoes', id], queryFn: () => listCaminhoes(id), enabled: !!id });
  const cps = useQuery({ queryKey: ['cps', id], queryFn: () => listCpsDaConcretagem(id), enabled: !!id });
  const evidencias = useQuery({ queryKey: ['evidencias', id], enabled: !!id, queryFn: async () => {
    const linhas = await listEvidencias(id);
    return Promise.all(linhas.map(async (r) => ({ ...r, url: await signedEvidencia(r.path).catch(() => '') })));
  } });
  const tracos = useQuery({ queryKey: ['tracos-fck'], queryFn: listTracosComFck });
  const colaboradores = useQuery({ queryKey: ['colaboradores-ref'], queryFn: listColaboradores });
  const cfg = useQuery({ queryKey: ['config_concretagem_recebimento', member?.tenant_id ?? 'none'], enabled: !!member, queryFn: () => getConfigLab(member?.tenant_id ?? '') });
  const pecas = useQuery({ queryKey: ['pecas-conc-detail', conc.data?.work_id ?? 'none'], queryFn: () => listPecasObra(conc.data?.work_id ?? ''), enabled: !!conc.data?.work_id });

  useEffect(() => {
    const c = conc.data;
    if (!c) return;
    setForm({
      operational_material_id: c.operational_material_id ?? '', traco_texto: c.traco_texto ?? '', fck_previsto: c.fck_previsto ?? '', fornecedor_texto: c.fornecedor_texto ?? '',
      data_programada: c.data_programada ?? '', hora_programada: c.hora_programada ?? '', data_real: c.data_real ?? '', hora_inicio: c.hora_inicio ?? '', hora_fim: c.hora_fim ?? '',
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
    setOpen(true);
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
      await addCaminhao(member.tenant_id, c, serie, { ...camForm, padrao_moldagem: camPadrao });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['caminhoes', id] }), qc.invalidateQueries({ queryKey: ['cps', id] }), qc.invalidateQueries({ queryKey: ['rompimentos'] }), qc.invalidateQueries({ queryKey: ['concretagem', id] }),
      ]);
      toast('Caminhão, amostra e CPs adicionados.', 'success');
      setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function ficha() { try { dl(await invokeFicha(id), 'ficha-moldagem-' + (conc.data?.codigo ?? id.slice(0, 6)) + '.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }
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
      if (!r.enabled) { toast(r.reason ?? 'Leitura por IA indisponível.', 'error'); setFichaCams([]); return; }
      setFichaCams(r.caminhoes); setFichaConf(r.confianca);
      toast(r.caminhoes.length + ' caminhão(ões) detectado(s). Confira antes de criar.', r.caminhoes.length ? 'success' : 'warning');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setLendoFicha(false); }
  }
  async function onCriarDetectados() {
    const c = conc.data; if (!member || !c) return;
    setGravandoFicha(true);
    try {
      const existentes = new Set((cams.data ?? []).map((x) => str(x.nota_fiscal)).filter(Boolean));
      let serie = (cams.data?.length ?? 0); let criados = 0;
      for (const cv of fichaCams) {
        const nf = str(cv.nota_fiscal);
        if (!nf || existentes.has(nf)) continue;
        serie += 1; criados += 1; existentes.add(nf);
        await addCaminhao(member.tenant_id, c, serie, { nota_fiscal: nf, placa: cv.placa ?? null, motorista: cv.motorista ?? null, volume_m3: cv.volume_m3 ?? null, slump_medido_cm: cv.slump_medido_cm ?? null, temperatura_concreto_c: cv.temperatura_concreto_c ?? null, hora_saida_usina: cv.hora_saida_usina ?? null, hora_chegada_obra: cv.hora_chegada_obra ?? null, hora_inicio_descarga: cv.hora_inicio_descarga ?? null, hora_fim_descarga: cv.hora_fim_descarga ?? null, external_key: 'ficha:' + nf });
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['caminhoes', id] }), qc.invalidateQueries({ queryKey: ['cps', id] }), qc.invalidateQueries({ queryKey: ['concretagem', id] })]);
      toast(criados ? (criados + ' caminhão(ões) criado(s).') : 'Nada novo a criar.', criados ? 'success' : 'info');
      if (criados) setFichaOpen(false);
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
        <div className="ml-auto flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void ficha()}>Gerar ficha PDF</Button>{step === 2 ? <Button variant="secondary" onClick={() => { setFichaCams([]); setFichaConf(null); setFichaOpen(true); }}>Ler ficha preenchida</Button> : null}<Button onClick={abrirCaminhao}>Adicionar caminhão</Button></div>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader title="Etapa 1 — Concretagem">Dados globais do atendimento. O padrão de moldagem daqui será usado quando o caminhão buscar o padrão da concretagem.</CardHeader>
          <div className="space-y-5 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Cliente" value={c.lab_clients?.razao_social ?? '-'} readOnly />
              <Field label="Obra" value={c.client_works?.nome ?? '-'} readOnly />
              <SelectField label="Traço cadastrado" value={val(form.operational_material_id)} onChange={(e) => { const idv = e.target.value; const t = (tracos.data ?? []).find((x) => x.value === idv); setForm((s) => ({ ...s, operational_material_id: idv, fck_previsto: t?.fck ?? s.fck_previsto, traco_texto: idv ? s.traco_texto : s.traco_texto })); if (t?.padrao_moldagem?.length) setPadrao(normalizePadroes(t.padrao_moldagem, t.fck)); }}><option value="">Manual / texto livre</option>{(tracos.data ?? []).map((t) => <option key={t.value} value={t.value}>{t.label}{t.fck != null ? ' · FCK ' + t.fck : ''}</option>)}</SelectField>
              {!form.operational_material_id ? <Field label="Traço / descrição manual" value={val(form.traco_texto)} onChange={(e) => patch('traco_texto', e.target.value)} /> : null}
              <Field label="FCK previsto (MPa)" type="number" value={val(form.fck_previsto)} onChange={(e) => patch('fck_previsto', e.target.value)} />
              {onC('fornecedor') ? <Field label="Fornecedor / central" value={val(form.fornecedor_texto)} onChange={(e) => patch('fornecedor_texto', e.target.value)} /> : null}
              {onC('data_hora') ? <><Field label="Data programada" type="date" value={val(form.data_programada)} onChange={(e) => patch('data_programada', e.target.value)} /><Field label="Hora programada" type="time" value={val(form.hora_programada)} onChange={(e) => patch('hora_programada', e.target.value)} /><Field label="Data real" type="date" value={val(form.data_real)} onChange={(e) => patch('data_real', e.target.value)} /><Field label="Início real" type="time" value={val(form.hora_inicio)} onChange={(e) => patch('hora_inicio', e.target.value)} /><Field label="Fim real" type="time" value={val(form.hora_fim)} onChange={(e) => patch('hora_fim', e.target.value)} /></> : null}
              {onC('local_peca') && (pecas.data ?? []).length ? <SelectField label="Peça da estrutura" value="" onChange={(e) => { const pc = (pecas.data ?? []).find((x) => x.id === e.target.value); if (pc) patch('local_texto', pc.label); }}><option value="">Selecionar para preencher local</option>{(pecas.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</SelectField> : null}
              {onC('local_peca') ? <Field label="Local / peça" value={val(form.local_texto)} onChange={(e) => patch('local_texto', e.target.value)} /> : null}
              {onC('volume_programado') ? <><Field label="Volume programado (m³)" type="number" value={val(form.volume_programado_m3)} onChange={(e) => patch('volume_programado_m3', e.target.value)} /><Field label="Volume lançado (m³)" type="number" value={val(form.volume_lancado_m3)} onChange={(e) => patch('volume_lancado_m3', e.target.value)} /></> : null}
              {onC('moldador') ? <SelectField label="Moldador" value={val(form.moldador_id)} onChange={(e) => patch('moldador_id', e.target.value)}><option value="">-</option>{(colaboradores.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</SelectField> : null}
              {onC('dimensao_cp') ? <SelectField label="Dimensão CP" value={val(form.dimensao_cp)} onChange={(e) => patch('dimensao_cp', e.target.value)}><option value="100x200">100 x 200 mm</option><option value="150x300">150 x 300 mm</option><option value="100x100x400">100 x 100 x 400 mm</option><option value="150x150x500">150 x 150 x 500 mm</option></SelectField> : null}
              {onC('clima') ? <Field label="Clima" value={val(form.clima)} onChange={(e) => patch('clima', e.target.value)} /> : null}
              {onC('temperatura_ambiente') ? <Field label="Temperatura ambiente (°C)" type="number" value={val(form.temperatura_ambiente_c)} onChange={(e) => patch('temperatura_ambiente_c', e.target.value)} /> : null}
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
                      <div><div className="font-black text-slate-950 dark:text-slate-50">Caminhão {cam.serie ?? '-'} · NF {cam.nota_fiscal}</div><div className="mt-1 text-xs text-slate-500">{onR('placa') ? `Placa ${cam.placa ?? '-'} · ` : ''}{onR('volume_m3') ? `Volume ${cam.volume_m3 ?? '-'} m³ · ` : ''}{onR('slump') ? `Slump ${cam.slump_medido_cm ?? '-'} cm · ` : ''}{onR('temperatura_concreto') ? `Temp. ${cam.temperatura_concreto_c ?? '-'} °C` : ''}</div></div>
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
                    <div className="border-t border-slate-100 p-4 dark:border-slate-800"><div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Corpos de prova</div>{cpsCam.length ? <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{cpsCam.map((cp) => <div key={cp.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><b>{cp.codigo ?? cp.id.slice(0, 8)}</b><span className="ml-2 text-slate-500">{cp.idade_dias ?? '-'} {cp.idade_unidade === 'hora' ? 'h' : 'd'} · {cp.situacao}</span>{cp.resultado != null ? <span className="ml-2 font-black text-green-700">{cp.resultado} MPa</span> : null}</div>)}</div> : <p className="text-sm text-slate-500">Sem CPs.</p>}</div>
                  </Card>
                );
              })}
            </div>
          )}

          <Card>
            <CardHeader kicker="Registro fotográfico" title="Evidências">Fotos do local, dos CPs ou da ficha física. Visíveis só para a equipe do laboratório.</CardHeader>
            <div className="space-y-3 p-4">
              <label className="flex flex-wrap items-center gap-3 text-sm"><span className="font-bold">Adicionar foto:</span><input type="file" accept="image/*" disabled={upEvi} onChange={(e) => { const f = e.target.files?.[0] ?? null; void onUploadEvidencia(f); e.currentTarget.value = ''; }} />{upEvi ? <span className="text-xs text-slate-500">enviando...</span> : null}</label>
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
            <label className="flex flex-wrap items-center gap-3 text-sm"><span className="font-bold">Ler NF (foto):</span><input type="file" accept="image/*" disabled={lendoNf} onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerNf(f); e.currentTarget.value = ''; }} />{lendoNf ? <span className="text-xs text-slate-500">lendo...</span> : null}</label>
            <p className="mt-1 text-xs text-slate-500">Fotografe a DANFE/nota do caminhao para preencher os campos. Requer VISION_API_KEY; confira antes de salvar.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nota fiscal*" value={val(camForm.nota_fiscal)} onChange={(e) => patchCam('nota_fiscal', e.target.value)} />
            {onR('placa') ? <Field label="Placa" value={val(camForm.placa)} onChange={(e) => patchCam('placa', e.target.value)} /> : null}
            {onR('motorista') ? <Field label="Motorista" value={val(camForm.motorista)} onChange={(e) => patchCam('motorista', e.target.value)} /> : null}
            {onR('volume_m3') ? <Field label="Volume (m³)" type="number" value={val(camForm.volume_m3)} onChange={(e) => patchCam('volume_m3', e.target.value === '' ? null : Number(e.target.value))} /> : null}
            {onR('slump') ? <Field label="Slump medido (cm)" type="number" value={val(camForm.slump_medido_cm)} onChange={(e) => patchCam('slump_medido_cm', e.target.value === '' ? null : Number(e.target.value))} /> : null}
            {onR('temperatura_concreto') ? <Field label="Temperatura concreto (°C)" type="number" value={val(camForm.temperatura_concreto_c)} onChange={(e) => patchCam('temperatura_concreto_c', e.target.value === '' ? null : Number(e.target.value))} /> : null}
            {onR('horarios_transporte') ? <><Field label="Saída da usina" type="time" value={val(camForm.hora_saida_usina)} onChange={(e) => patchCam('hora_saida_usina', e.target.value)} /><Field label="Chegada à obra" type="time" value={val(camForm.hora_chegada_obra)} onChange={(e) => patchCam('hora_chegada_obra', e.target.value)} /></> : null}
            {onR('horarios_descarga') ? <><Field label="Início descarga" type="time" value={val(camForm.hora_inicio_descarga)} onChange={(e) => patchCam('hora_inicio_descarga', e.target.value)} /><Field label="Fim descarga" type="time" value={val(camForm.hora_fim_descarga)} onChange={(e) => patchCam('hora_fim_descarga', e.target.value)} /></> : null}
            {onR('hora_moldagem') ? <Field label="Hora moldagem" type="time" value={val(camForm.hora_moldagem)} onChange={(e) => patchCam('hora_moldagem', e.target.value)} /> : null}
            {onR('agua_adicionada') ? <><label className="flex items-center gap-2 pt-7 text-sm font-bold"><input type="checkbox" checked={camForm.houve_adicao_agua === true} onChange={(e) => patchCam('houve_adicao_agua', e.target.checked)} /> Houve adição de água</label><Field label="Água adicionada (L)" type="number" value={val(camForm.agua_litros)} onChange={(e) => patchCam('agua_litros', e.target.value === '' ? null : Number(e.target.value))} /></> : null}
            {onR('rejeicao') ? <><label className="flex items-center gap-2 pt-7 text-sm font-bold"><input type="checkbox" checked={camForm.rejeitado === true} onChange={(e) => patchCam('rejeitado', e.target.checked)} /> Caminhão rejeitado</label><Field label="Motivo rejeição" value={val(camForm.motivo_rejeicao)} onChange={(e) => patchCam('motivo_rejeicao', e.target.value)} /></> : null}
          </div>
          {onR('elementos_concretados') ? <TextArea label="Elementos concretados" value={val(camForm.elementos_concretados)} onChange={(e) => patchCam('elementos_concretados', e.target.value)} /> : null}
          {onR('observacoes_caminhao') ? <TextArea label="Observações do caminhão" value={val(camForm.observacoes)} onChange={(e) => patchCam('observacoes', e.target.value)} /> : null}
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-slate-950 dark:text-slate-50">Amostra e CPs deste caminhão</h3><p className="text-xs text-slate-500">Ajuste idades e quantidades antes de salvar. O sistema gera os CPs automaticamente.</p></div><Button variant="secondary" onClick={buscarPadraoCaminhao}>Buscar padrão de moldagem</Button></div>
            <MoldingStandardEditor value={camPadrao} onChange={setCamPadrao} fck={fckAtual} />
          </div>
        </div>
      </Modal>

      <Modal open={fichaOpen} wide title="Conferir ficha preenchida (foto)" onClose={() => setFichaOpen(false)} footer={<><Button variant="ghost" onClick={() => setFichaOpen(false)}>Fechar</Button>{fichaCams.length ? <Button onClick={() => void onCriarDetectados()} disabled={gravandoFicha}>{gravandoFicha ? 'Criando...' : 'Criar caminhões detectados'}</Button> : null}</>}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <label className="flex flex-wrap items-center gap-3 text-sm"><span className="font-bold">Foto da ficha:</span><input type="file" accept="image/*" disabled={lendoFicha} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onLerFicha(f); e.currentTarget.value = ''; }} />{lendoFicha ? <span className="text-xs text-slate-500">lendo...</span> : null}</label>
            <p className="mt-1 text-xs text-slate-500">Fotografe a ficha de moldagem preenchida. O QR identifica a concretagem; a IA extrai os caminhões. Requer VISION_API_KEY. Confira antes de criar.</p>
          </div>
          {fichaConf != null ? <div className="text-xs text-slate-500">Confiança da leitura: <b>{Math.round((fichaConf ?? 0) * 100)}%</b></div> : null}
          {fichaCams.length === 0 ? <p className="text-sm text-slate-500">Nenhum caminhão detectado ainda.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1 pr-3">NF</th><th className="py-1 pr-3">Placa</th><th className="py-1 pr-3">Vol.</th><th className="py-1 pr-3">Slump</th><th className="py-1 pr-3">Temp.</th><th className="py-1 pr-3">Situação</th></tr></thead>
                <tbody>{fichaCams.map((cv, i) => { const existe = (cams.data ?? []).some((x) => str(x.nota_fiscal) && str(x.nota_fiscal) === str(cv.nota_fiscal)); return (<tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1 pr-3 font-bold">{cv.nota_fiscal ?? '-'}</td><td className="py-1 pr-3">{cv.placa ?? '-'}</td><td className="py-1 pr-3">{cv.volume_m3 ?? '-'}</td><td className="py-1 pr-3">{cv.slump_medido_cm ?? '-'}</td><td className="py-1 pr-3">{cv.temperatura_concreto_c ?? '-'}</td><td className="py-1 pr-3">{existe ? <span className="text-slate-400">já lançado</span> : <span className="font-bold text-green-700">novo</span>}</td></tr>); })}</tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
