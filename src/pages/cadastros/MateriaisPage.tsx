import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listTracos, saveTraco, signedCartaTraco, softDeleteTraco, uploadCartaTraco, type TracoRow } from '../../lib/api/materiais';
import { openDeferredTab } from '../../lib/pdf';
import { listClientesRef } from '../../lib/api/obras';
import { listReference } from '../../lib/api/client';
import {
  PADRAO_MOLDAGEM_SHORTCUTS,
  TIPO_ENSAIO_OPCOES,
  UNIDADE_IDADE_OPCOES,
  TRACOS_PADRAO,
  codigoTracoFromDescricao,
  linhaDeAtalho,
  normalizePadroes,
  padraoMoldagemAgeInHours,
  padroesMoldagemPadrao,
  padroesToDb,
  parseSlumpFromDescricao,
  toNumber,
  type PadraoMoldagem,
  type TipoEnsaioPadrao,
  type UnidadeIdade,
  type TracoPadrao,
} from '../../lib/concreto';

const str = (v: unknown): string => String(v ?? '').trim();
const num = (v: unknown): number | null => toNumber(v as number | string | null | undefined);

type FormState = {
  descricao: string;
  aplicacao: string;
  fck_mpa: string;
  fcj_mpa: string;
  desvio_padrao_mpa: string;
  slump_previsto_cm: string;
  slump_tolerancia_cm: string;
  validade_concreto_minutos: string;
  idade_controle_dias: string;
  condicao_preparo: string;
  brita: string;
  dmax_agregado_mm: string;
  fator_ac: string;
  cimento_tipo: string;
  consumo_cimento_kg_m3: string;
  aditivo_tipo: string;
  metodo_cura: string;
  especificacao: string;
  observacoes: string;
  bombeado: boolean;
  comp_cimento_marca: string;
  comp_cimento_proc: string;
  comp_brita_marca: string;
  comp_brita_proc: string;
  comp_areia_marca: string;
  comp_areia_proc: string;
  comp_aditivo_marca: string;
  comp_aditivo_proc: string;
  comp_agua_proc: string;
  escopo: 'lab' | 'construtora' | 'obra';
  client_id: string;
  work_id: string;
};

function vazio(): FormState {
  return {
    descricao: 'FCK 30 | BRITA 1 | SLUMP 10±2 CM', aplicacao: 'Sapata, Cortina, Blocos', fck_mpa: '30', fcj_mpa: '', desvio_padrao_mpa: '',
    slump_previsto_cm: '10', slump_tolerancia_cm: '2', validade_concreto_minutos: '150', idade_controle_dias: '28', condicao_preparo: '', brita: '1', dmax_agregado_mm: '', fator_ac: '', cimento_tipo: '', consumo_cimento_kg_m3: '', aditivo_tipo: '', metodo_cura: '', especificacao: '', observacoes: '', bombeado: false, comp_cimento_marca: '', comp_cimento_proc: '', comp_brita_marca: '', comp_brita_proc: '', comp_areia_marca: '', comp_areia_proc: '', comp_aditivo_marca: '', comp_aditivo_proc: '', comp_agua_proc: '',
    escopo: 'lab', client_id: '', work_id: '',
  };
}

function fromRow(t: TracoRow): FormState {
  const cmp = (t.componentes ?? {}) as Record<string, any>;
  const compVal = (k: string, a: string) => String((cmp?.[k] as Record<string, unknown> | undefined)?.[a] ?? '');
  return {
    descricao: t.nome || t.codigo || '',
    aplicacao: t.aplicacao ?? '',
    fck_mpa: t.fck_mpa == null ? '' : String(t.fck_mpa),
    fcj_mpa: t.fcj_mpa == null ? '' : String(t.fcj_mpa),
    desvio_padrao_mpa: t.desvio_padrao_mpa == null ? '' : String(t.desvio_padrao_mpa),
    slump_previsto_cm: t.slump_previsto_cm == null ? '' : String(t.slump_previsto_cm),
    slump_tolerancia_cm: t.slump_tolerancia_cm == null ? '' : String(t.slump_tolerancia_cm),
    validade_concreto_minutos: t.validade_concreto_minutos == null ? '' : String(t.validade_concreto_minutos),
    idade_controle_dias: t.idade_controle_dias == null ? '' : String(t.idade_controle_dias),
    condicao_preparo: t.condicao_preparo ?? '',
    brita: t.brita ?? '',
    dmax_agregado_mm: t.dmax_agregado_mm == null ? '' : String(t.dmax_agregado_mm),
    fator_ac: t.fator_ac == null ? '' : String(t.fator_ac),
    cimento_tipo: t.cimento_tipo ?? '',
    consumo_cimento_kg_m3: t.consumo_cimento_kg_m3 == null ? '' : String(t.consumo_cimento_kg_m3),
    aditivo_tipo: t.aditivo_tipo ?? '',
    metodo_cura: t.metodo_cura ?? '',
    especificacao: t.especificacao ?? '',
    observacoes: t.observacoes ?? '',
    bombeado: !!t.bombeado,
    comp_cimento_marca: compVal('cimento','marca'), comp_cimento_proc: compVal('cimento','procedencia'),
    comp_brita_marca: compVal('brita','marca'), comp_brita_proc: compVal('brita','procedencia'),
    comp_areia_marca: compVal('areia','marca'), comp_areia_proc: compVal('areia','procedencia'),
    comp_aditivo_marca: compVal('aditivo','marca'), comp_aditivo_proc: compVal('aditivo','procedencia'),
    comp_agua_proc: compVal('agua','procedencia'),
    escopo: t.work_id ? 'obra' : (t.client_id ? 'construtora' : 'lab'),
    client_id: t.client_id ?? '',
    work_id: t.work_id ?? '',
  };
}

function parseBrita(descricao: string): string {
  const m = /BRITA\s*([0-9A-Z]+)/i.exec(descricao);
  return m?.[1] ?? '';
}

function aplicarPadrao(p: TracoPadrao, atual: FormState, setF: (v: FormState) => void, setPadrao: (v: PadraoMoldagem[]) => void) {
  const base = vazio();
  base.escopo = atual.escopo; base.client_id = atual.client_id; base.work_id = atual.work_id; // não perde o escopo já escolhido
  base.descricao = p.descricao;
  base.aplicacao = p.aplicacao;
  base.fck_mpa = String(p.fck);
  base.slump_previsto_cm = String(p.slumpPrevisto);
  base.slump_tolerancia_cm = String(p.slumpTolerancia);
  base.validade_concreto_minutos = String(p.validadeMinutos);
  base.brita = p.brita ?? parseBrita(p.descricao);
  setF(base);
  setPadrao(padroesMoldagemPadrao(p.fck));
}

export function MateriaisPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<FormState>(vazio());
  const [padrao, setPadrao] = useState<PadraoMoldagem[]>(padroesMoldagemPadrao(30));
  const [busy, setBusy] = useState(false);
  const [cartaFile, setCartaFile] = useState<File | null>(null);
  const [cartaPath, setCartaPath] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['tracos'], queryFn: listTracos });
  const [filtroConstrutora, setFiltroConstrutora] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [spT, setSpT] = useSearchParams();
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed único no mount (deep-link ?work= vindo das telas de concretagem)
  useEffect(() => {
    const w = spT.get('work');
    if (w) { setFiltroObra(w); spT.delete('work'); setSpT(spT, { replace: true }); }
  }, []);
  const construtoras = useQuery({ queryKey: ['ref', 'lab_clients', 'tracos'], queryFn: () => listClientesRef() });
  const obrasDoEscopo = useQuery({ queryKey: ['ref', 'client_works', f.client_id, 'tracos'], queryFn: () => listReference('client_works', 'nome', f.client_id ? { client_id: f.client_id } : undefined), enabled: !!f.client_id });

  const fckAtual = useMemo(() => num(f.fck_mpa), [f.fck_mpa]);
  const normDesc = (v: string) => v.trim().toUpperCase().replace(/\s+/g, ' ');
  const escopoLabel = (t: TracoRow) => t.work_id ? 'obra ' + (t.client_works?.nome ?? '—') : t.client_id ? 'construtora ' + (t.lab_clients?.nome_fantasia || t.lab_clients?.razao_social || '—') : 'catálogo do laboratório';
  const duplicados = useMemo(() => {
    const d = normDesc(f.descricao);
    if (!d) return [] as TracoRow[];
    return (q.data ?? []).filter((t) => t.id !== editId && normDesc(t.nome || t.codigo || '') === d);
  }, [q.data, f.descricao, editId]);

  function novo() {
    setEditId(null);
    setF(vazio());
    setPadrao(padroesMoldagemPadrao(30));
    setCartaFile(null); setCartaPath(null);
    setOpen(true);
  }

  function editar(t: TracoRow) {
    setEditId(t.id);
    setF(fromRow(t));
    setPadrao(normalizePadroes(t.padrao_moldagem, t.fck_mpa));
    setCartaFile(null); setCartaPath(t.carta_traco_path ?? null);
    setOpen(true);
  }

  function duplicar(t: TracoRow) {
    setEditId(null);
    setF(fromRow(t));
    setPadrao(normalizePadroes(t.padrao_moldagem, t.fck_mpa));
    setCartaFile(null); setCartaPath(null); // a carta não acompanha a cópia
    setOpen(true);
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) { setF((s) => ({ ...s, [key]: value })); }
  const ordenado = (arr: PadraoMoldagem[]) => [...arr].sort((a, b) => padraoMoldagemAgeInHours(a) - padraoMoldagemAgeInHours(b));
  function addAtalho(sc: (typeof PADRAO_MOLDAGEM_SHORTCUTS)[number]) { setPadrao((s) => ordenado([...s, linhaDeAtalho(sc, fckAtual)])); }
  function setPm(i: number, patchRow: Partial<PadraoMoldagem>) { setPadrao((s) => s.map((r, idx) => idx === i ? { ...r, ...patchRow } : r)); }
  function rmPm(i: number) { setPadrao((s) => s.filter((_, idx) => idx !== i)); }
  function ordenar() { setPadrao((s) => [...s].sort((a, b) => padraoMoldagemAgeInHours(a) - padraoMoldagemAgeInHours(b))); }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!str(f.descricao)) throw new Error('Descrição é obrigatória.');
      const fckNum = num(f.fck_mpa);
      if (fckNum == null || fckNum <= 0) throw new Error('FCK (MPa) é obrigatório.');
      if (f.escopo !== 'lab' && !str(f.client_id)) throw new Error('Selecione a construtora do traço.');
      if (f.escopo === 'obra' && !str(f.work_id)) throw new Error('Selecione a obra do traço.');
      const slump = parseSlumpFromDescricao(f.descricao);
      const descricao = str(f.descricao);
      const payload = {
        codigo: codigoTracoFromDescricao(descricao),
        nome: descricao,
        aplicacao: str(f.aplicacao) || null,
        fck_mpa: num(f.fck_mpa),
        fcj_mpa: num(f.fcj_mpa),
        desvio_padrao_mpa: num(f.desvio_padrao_mpa),
        condicao_preparo: str(f.condicao_preparo) || null,
        slump_previsto_cm: num(f.slump_previsto_cm) ?? slump?.previsto ?? null,
        slump_tolerancia_cm: num(f.slump_tolerancia_cm) ?? slump?.tolerancia ?? null,
        validade_concreto_minutos: num(f.validade_concreto_minutos),
        idade_controle_dias: num(f.idade_controle_dias),
        brita: str(f.brita) || parseBrita(descricao) || null,
        dmax_agregado_mm: num(f.dmax_agregado_mm),
        fator_ac: num(f.fator_ac),
        cimento_tipo: str(f.cimento_tipo) || null,
        consumo_cimento_kg_m3: num(f.consumo_cimento_kg_m3),
        aditivo_tipo: str(f.aditivo_tipo) || null,
        metodo_cura: str(f.metodo_cura) || null,
        especificacao: str(f.especificacao) || null,
        bombeado: f.bombeado,
        observacoes: str(f.observacoes) || null,
        padrao_moldagem: padroesToDb(ordenado(padrao)), // menor idade sempre primeiro (persistido ordenado)
        carta_traco_path: cartaPath,
        componentes: (() => { const c: Record<string, unknown> = {}; const add = (k: string, m: unknown, pr: unknown) => { const mm = str(m), pp = str(pr); if (mm || pp) c[k] = { marca: mm || null, procedencia: pp || null }; }; add('cimento', f.comp_cimento_marca, f.comp_cimento_proc); add('brita', f.comp_brita_marca, f.comp_brita_proc); add('areia', f.comp_areia_marca, f.comp_areia_proc); add('aditivo', f.comp_aditivo_marca, f.comp_aditivo_proc); { const pp = str(f.comp_agua_proc); if (pp) c['agua'] = { procedencia: pp }; } return c; })(),
        schema_campos: { origem_ui: 'geolab-v23-geomat-tracos' },
        work_id: f.escopo === 'obra' ? (str(f.work_id) || null) : null,
        client_id: f.escopo === 'lab' ? null : (str(f.client_id) || null),
      };
      const wid = payload.work_id ?? null, cid = payload.client_id ?? null;
      if (duplicados.some((t) => (t.work_id ?? null) === wid && (t.client_id ?? null) === cid)) {
        throw new Error('Já existe um traço com esta mesma descrição neste escopo. Altere a descrição (ou edite o traço existente).');
      }
      if (duplicados.length) {
        const ok = await confirm({ title: 'Descrição duplicada', message: 'Já existe um traço com esta mesma descrição em: ' + duplicados.map(escopoLabel).join(' · ') + '. Salvar mesmo assim?', confirmLabel: 'Salvar mesmo assim' });
        if (!ok) return;
      }
      const tracoId = await saveTraco(member.tenant_id, editId, payload);
      if (cartaFile) {
        const pth = await uploadCartaTraco(member.tenant_id, tracoId, cartaFile);
        await saveTraco(member.tenant_id, tracoId, { carta_traco_path: pth });
        setCartaPath(pth); setCartaFile(null);
      }
      await qc.invalidateQueries({ queryKey: ['tracos'] });
      await qc.invalidateQueries({ queryKey: ['tracos_ref'] });
      await qc.invalidateQueries({ queryKey: ['tracos-fck'] });
      toast('Traço salvo.', 'success');
      setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  function abrirCarta(path: string) {
    const tab = openDeferredTab('Abrindo carta traço…');
    signedCartaTraco(path).then((u) => tab.set(u)).catch((e) => { tab.fail(); toast((e as Error).message, 'error'); });
  }

  async function excluir(t: TracoRow) {
    if (!(await confirm({ title: 'Excluir traço', message: 'Excluir o traço ' + t.codigo + '?', danger: true, confirmLabel: 'Excluir' }))) return;
    try { await softDeleteTraco(t.id); await qc.invalidateQueries({ queryKey: ['tracos'] }); toast('Excluído.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  const rows = q.data ?? [];
  const obrasFiltroOpts = useMemo(() => { const m = new Map<string, string>(); for (const t of rows) if (t.work_id) m.set(t.work_id, t.client_works?.nome ?? 'Obra'); return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])); }, [rows]);
  const rowsView = rows.filter((t) => !filtroConstrutora ? true : filtroConstrutora === '__lab__' ? (!t.client_id && !t.work_id) : t.client_id === filtroConstrutora).filter((t) => !filtroObra ? true : t.work_id === filtroObra);
  return (
    <div className="space-y-4">
      <PageHeader kicker="Cadastros" title="Traços de concreto" description="Cadastro de traços, slump, validade e padrão de moldagem no mesmo modelo da Nova obra." />
      <div className="flex flex-wrap items-center justify-between gap-2"><select className="input max-w-[280px]" value={filtroConstrutora} onChange={(e) => setFiltroConstrutora(e.target.value)} aria-label="Filtrar por escopo"><option value="">Todos os escopos</option><option value="__lab__">Catálogo do laboratório</option>{(construtoras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>{obrasFiltroOpts.length ? <select className="input max-w-[240px]" value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)} aria-label="Filtrar por obra"><option value="">Todas as obras</option>{obrasFiltroOpts.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select> : null}<Button onClick={novo}>+ Adicionar traço</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rowsView.length === 0 ? <EmptyState /> : (
        <Card>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rowsView.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-950 dark:text-slate-50">{t.nome}</span>{t.work_id ? <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Obra: {t.client_works?.nome ?? '—'}</span> : t.client_id ? <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Construtora: {t.lab_clients?.nome_fantasia || t.lab_clients?.razao_social || '—'}</span> : <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Catálogo do lab</span>}</div>
                  <div className="mt-1 text-xs text-slate-500">{t.aplicacao || '-'} · FCK {t.fck_mpa ?? '-'} MPa · slump {t.slump_previsto_cm ?? '-'}±{t.slump_tolerancia_cm ?? '-'} cm · validade {t.validade_concreto_minutos ?? '-'} min{t.idade_controle_dias != null ? ` · controle ${t.idade_controle_dias}d` : ''} · {normalizePadroes(t.padrao_moldagem, t.fck_mpa).length} idade(s)</div>
                </div>
                <div className="flex gap-2">
                  {t.carta_traco_path ? <Button variant="ghost" onClick={() => abrirCarta(t.carta_traco_path as string)}>Carta traço</Button> : null}
                  <Button variant="ghost" onClick={() => editar(t)}>Editar</Button>
                  <Button variant="ghost" onClick={() => duplicar(t)}>Duplicar</Button>
                  <Button variant="ghost" onClick={() => void excluir(t)}>Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={open} wide title={editId ? 'Editar traço de concreto' : 'Novo traço de concreto'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar traço'}</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <SelectField label="Escopo do traço" value={f.escopo} onChange={(e) => { const v = e.target.value as FormState['escopo']; setF((s) => ({ ...s, escopo: v, client_id: v === 'lab' ? '' : s.client_id, work_id: v === 'obra' ? s.work_id : '' })); }}><option value="lab">Catálogo do laboratório (todas as obras)</option><option value="construtora">Construtora (reutilizável nas obras dela)</option><option value="obra">Obra específica</option></SelectField>
            {f.escopo !== 'lab' ? <SelectField label="Construtora" value={f.client_id} onChange={(e) => setF((s) => ({ ...s, client_id: e.target.value, work_id: '' }))}><option value="">-</option>{(construtoras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField> : null}
            {f.escopo === 'obra' ? <SelectField label="Obra" value={f.work_id} onChange={(e) => setF((s) => ({ ...s, work_id: e.target.value }))}><option value="">-</option>{(obrasDoEscopo.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField> : null}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Traços-padrão:</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {TRACOS_PADRAO.map((p) => <button type="button" key={p.descricao} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" onClick={() => aplicarPadrao(p, f, setF, setPadrao)}>{p.descricao}</button>)}
            </div>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-black text-slate-900 dark:text-slate-100">Concreto 1</div>
              
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Descrição *" value={f.descricao} onChange={(e) => patch('descricao', e.target.value)} />
              <Field label="Aplicação" value={f.aplicacao} onChange={(e) => patch('aplicacao', e.target.value)} />
              {duplicados.length ? <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Já existe um traço com esta mesma descrição em: {duplicados.map(escopoLabel).join(' · ')}.</div> : null}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field label="FCK (MPa) *" type="number" value={f.fck_mpa} onChange={(e) => patch('fck_mpa', e.target.value)} />
              <Field label="Slump prev. (cm)" type="number" value={f.slump_previsto_cm} onChange={(e) => patch('slump_previsto_cm', e.target.value)} />
              <Field label="Tolerância (±cm)" type="number" value={f.slump_tolerancia_cm} onChange={(e) => patch('slump_tolerancia_cm', e.target.value)} />
              <Field label="Validade (min)" type="number" value={f.validade_concreto_minutos} onChange={(e) => patch('validade_concreto_minutos', e.target.value)} />
              <Field label="Idade de controle (dias)" type="number" value={f.idade_controle_dias} onChange={(e) => patch('idade_controle_dias', e.target.value)} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <SelectField label="Cond. preparo" value={f.condicao_preparo} onChange={(e) => patch('condicao_preparo', e.target.value)}><option value="">— não informada</option>{['A', 'B', 'C'].map((x) => <option key={x} value={x}>{x}</option>)}</SelectField>
              <Field label="FCJ (MPa)" type="number" value={f.fcj_mpa} onChange={(e) => patch('fcj_mpa', e.target.value)} />
              <Field label="Desvio padrão (MPa)" type="number" value={f.desvio_padrao_mpa} onChange={(e) => patch('desvio_padrao_mpa', e.target.value)} />
              <Field label="Brita" value={f.brita} onChange={(e) => patch('brita', e.target.value)} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field label="Dmáx agregado (mm)" type="number" value={f.dmax_agregado_mm} onChange={(e) => patch('dmax_agregado_mm', e.target.value)} />
              <Field label="Fator a/c" type="number" value={f.fator_ac} onChange={(e) => patch('fator_ac', e.target.value)} />
              <Field label="Cimento" value={f.cimento_tipo} onChange={(e) => patch('cimento_tipo', e.target.value)} />
              <Field label="Consumo cimento" type="number" value={f.consumo_cimento_kg_m3} onChange={(e) => patch('consumo_cimento_kg_m3', e.target.value)} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Aditivo" value={f.aditivo_tipo} onChange={(e) => patch('aditivo_tipo', e.target.value)} />
              <Field label="Método de cura" value={f.metodo_cura} onChange={(e) => patch('metodo_cura', e.target.value)} />
              <label className="mt-7 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={f.bombeado} onChange={(e) => patch('bombeado', e.target.checked)} /> Bombeado</label>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Composição — marca / procedência (sai no laudo se habilitado)</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Cimento — marca" value={f.comp_cimento_marca} onChange={(e) => patch('comp_cimento_marca', e.target.value)} />
                <Field label="Cimento — procedência" value={f.comp_cimento_proc} onChange={(e) => patch('comp_cimento_proc', e.target.value)} />
                <Field label="Brita — marca" value={f.comp_brita_marca} onChange={(e) => patch('comp_brita_marca', e.target.value)} />
                <Field label="Brita — procedência" value={f.comp_brita_proc} onChange={(e) => patch('comp_brita_proc', e.target.value)} />
                <Field label="Areia — marca" value={f.comp_areia_marca} onChange={(e) => patch('comp_areia_marca', e.target.value)} />
                <Field label="Areia — procedência" value={f.comp_areia_proc} onChange={(e) => patch('comp_areia_proc', e.target.value)} />
                <Field label="Aditivo — marca" value={f.comp_aditivo_marca} onChange={(e) => patch('comp_aditivo_marca', e.target.value)} />
                <Field label="Aditivo — procedência" value={f.comp_aditivo_proc} onChange={(e) => patch('comp_aditivo_proc', e.target.value)} />
                <Field label="Água — procedência/fonte" value={f.comp_agua_proc} onChange={(e) => patch('comp_agua_proc', e.target.value)} />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="text-sm font-bold text-slate-600 dark:text-slate-300">Carta traço (anexo)</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="text-xs" aria-label="Anexar carta traço" onChange={(e) => setCartaFile(e.target.files?.[0] ?? null)} />
                {cartaPath && !cartaFile ? <button type="button" className="text-xs font-bold" style={{ color: 'var(--magenta)' }} onClick={() => abrirCarta(cartaPath)}>ver carta atual</button> : null}
                {cartaPath || cartaFile ? <button type="button" className="text-xs font-bold text-slate-400 hover:text-red-600" onClick={() => { setCartaFile(null); setCartaPath(null); }}>Remover</button> : null}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">PDF ou imagem, até 15 MB. Com a carta anexada, o botão “Carta traço” aparece na lista de traços.</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextArea label="Especificação / composição" value={f.especificacao} onChange={(e) => patch('especificacao', e.target.value)} />
              <TextArea label="Observações" value={f.observacoes} onChange={(e) => patch('observacoes', e.target.value)} />
            </div>

            <div className="mt-5">
              <div className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Padrão de moldagem</div>
              <div className="mb-3 flex flex-wrap gap-2">
                {PADRAO_MOLDAGEM_SHORTCUTS.map((a) => <button type="button" key={a.label} onClick={() => addAtalho(a)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{a.label}</button>)}
                <button type="button" onClick={ordenar} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Ordenar</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Idade</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Tipo de ensaio</th><th className="px-3 py-2">Valor esp. (MPa)</th><th className="px-3 py-2">Cresc. %</th><th className="px-3 py-2">Qtd CP</th><th /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {padrao.map((p, i) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 text-xs font-bold text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2"><input className="input" type="number" value={String(p.idadeControle)} onChange={(e) => setPm(i, { idadeControle: e.target.value })} /></td>
                        <td className="px-3 py-2"><select className="input" value={p.unidadeIdade} onChange={(e) => setPm(i, { unidadeIdade: e.target.value as UnidadeIdade })}>{UNIDADE_IDADE_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                        <td className="px-3 py-2"><select className="input" value={p.tipoEnsaio} onChange={(e) => setPm(i, { tipoEnsaio: e.target.value as TipoEnsaioPadrao })}>{TIPO_ENSAIO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                        <td className="px-3 py-2"><input className="input" type="number" value={String(p.valorEsperado)} onChange={(e) => setPm(i, { valorEsperado: e.target.value })} /></td>
                        <td className="px-3 py-2"><input className="input" type="number" value={String(p.crescimentoPct)} onChange={(e) => setPm(i, { crescimentoPct: e.target.value })} /></td>
                        <td className="px-3 py-2"><input className="input" type="number" value={String(p.quantidadeCp)} onChange={(e) => setPm(i, { quantidadeCp: e.target.value })} /></td>
                        <td className="px-3 py-2"><button type="button" className="text-slate-400 hover:text-red-600" onClick={() => rmPm(i)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3"><Button variant="ghost" onClick={() => setPadrao((s) => ordenado([...s, linhaDeAtalho(PADRAO_MOLDAGEM_SHORTCUTS[0], fckAtual)]))}>+ Adicionar idade</Button></div>
            </div>
          </Card>
        </div>
      </Modal>
    </div>
  );
}
