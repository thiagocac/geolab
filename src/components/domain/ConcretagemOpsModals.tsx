import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../lib/toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, SelectField } from '../ui/Field';
import { MoldingStandardEditor } from './MoldingStandardEditor';
import { clampNum } from '../../lib/validacao';
import { atribuirEquipe, provisionarFormas, listEquipeColaboradores, padraoMoldagemDaConcretagem, type ConcretagemRow } from '../../lib/api/concretagem';
import { toNumber, padroesToDb, type PadraoMoldagem } from '../../lib/concreto';

// Modais de ação de programação/concretagem — Atribuir equipe e Provisionar fôrmas —
// extraídos da ProgramacoesPage (v220) para reuso na central de Concretagens.
// Renderizar condicionalmente ({row ? <EquipeModal row={row}…/> : null}): o mount semeia o estado.
// Ao salvar, invalidam 'programacoes' E 'concretagens' (as duas telas ficam coerentes).

export function EquipeModal({ row, onClose }: { row: ConcretagemRow; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const colabs = useQuery({ queryKey: ['equipe-colabs'], queryFn: listEquipeColaboradores });
  const [moldadorId, setMoldadorId] = useState(row.moldador_id ?? '');
  const [labId, setLabId] = useState(row.laboratorista_id ?? '');
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setBusy(true);
    try {
      await atribuirEquipe(row.id, moldadorId || null, labId || null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['programacoes'] }), qc.invalidateQueries({ queryKey: ['concretagens'] })]);
      toast('Equipe atribuída.', 'success');
      onClose();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <Modal open title={'Atribuir equipe' + (row.numero_relatorio ? ' — ' + row.numero_relatorio : '')} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} busy={busy}>{busy ? 'Salvando…' : 'Salvar equipe'}</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Vincule o moldador e o laboratorista que vão atender esta programação. Aparecem na ficha de moldagem e na agenda do laboratório.</p>
        <SelectField label="Moldador" value={moldadorId} onChange={(e) => setMoldadorId(e.target.value)}>
          <option value="">A definir</option>
          {(colabs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.funcoes.length ? ' — ' + c.funcoes.join(', ') : ''}</option>)}
        </SelectField>
        <SelectField label="Laboratorista" value={labId} onChange={(e) => setLabId(e.target.value)}>
          <option value="">A definir</option>
          {(colabs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.funcoes.length ? ' — ' + c.funcoes.join(', ') : ''}</option>)}
        </SelectField>
        {colabs.data && colabs.data.length === 0 ? <p className="text-xs" style={{ color: 'var(--magenta)' }}>Nenhum colaborador cadastrado. Cadastre em Cadastros › Colaboradores.</p> : null}
      </div>
    </Modal>
  );
}

export function FormasModal({ row, onClose }: { row: ConcretagemRow; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [cap, setCap] = useState('8');
  const [nAmostrasStr, setNAmostrasStr] = useState(() => { const v = row.volume_programado_m3 ?? null; return v && v > 0 ? String(Math.max(1, Math.ceil(v / 8))) : '1'; });
  const [nAmostrasTouched, setNAmostrasTouched] = useState(false);
  // Margem extra (%) de segurança — semeia do provisionamento anterior (metadata.formas.extra_pct).
  const metaFormas = ((row.metadata as Record<string, unknown> | null | undefined)?.formas ?? null) as { extra_pct?: number } | null;
  const [margem, setMargem] = useState(metaFormas?.extra_pct != null ? String(metaFormas.extra_pct) : '0');
  // Traço cadastrado: padrão vem do traço (read-only). Não cadastrado: padrão editável.
  const [padraoEdit, setPadraoEdit] = useState<PadraoMoldagem[]>(() => padraoMoldagemDaConcretagem(row));
  const [busy, setBusy] = useState(false);

  const capNum = Math.max(1, toNumber(cap) ?? 8);
  const volume = row.volume_programado_m3 ?? null;
  const estAmostras = volume && volume > 0 ? Math.max(1, Math.ceil(volume / capNum)) : 1;
  useEffect(() => { if (!nAmostrasTouched) setNAmostrasStr(String(estAmostras)); }, [estAmostras, nAmostrasTouched]);
  const nAmostras = Math.max(1, Math.floor(toNumber(nAmostrasStr) ?? estAmostras));
  const tracoRegistrado = !!row.operational_material_id;
  const padraoAtivo = tracoRegistrado ? padraoMoldagemDaConcretagem(row) : padraoEdit;
  const cpsAmostra = padraoAtivo.reduce((s, p) => s + (toNumber(p.quantidadeCp) ?? 0), 0);
  const margemPct = Math.min(100, Math.max(0, toNumber(margem) ?? 0));
  const formasBase = cpsAmostra * nAmostras;
  const formasNecessarias = Math.ceil(formasBase * (1 + margemPct / 100));

  async function salvar() {
    setBusy(true);
    try {
      await provisionarFormas(row.id, formasNecessarias, { n_amostras: nAmostras, cps_por_amostra: cpsAmostra, capacidade_m3: capNum, volume_m3: volume, extra_pct: margemPct }, row.metadata ?? null, tracoRegistrado ? null : padroesToDb(padraoEdit));
      await Promise.all([qc.invalidateQueries({ queryKey: ['programacoes'] }), qc.invalidateQueries({ queryKey: ['concretagens'] })]);
      toast(formasNecessarias + ' fôrma(s) provisionada(s) — entrega lançada automaticamente para a obra.', 'success');
      onClose();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <Modal open wide title={'Provisionar fôrmas' + (row.numero_relatorio ? ' — ' + row.numero_relatorio : '')} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} busy={busy} disabled={formasNecessarias <= 0}>{busy ? 'Salvando…' : 'Salvar provisão'}</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">As fôrmas (moldes de CP) são calculadas a partir do padrão de moldagem do traço: <b>CPs por amostra × nº de amostras (caminhões) = formas necessárias</b>.</p>
        {tracoRegistrado ? (
          <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
            <div className="flex justify-between"><span className="text-slate-500">Padrão de moldagem</span><span className="font-bold">{cpsAmostra} CP por amostra</span></div>
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {padraoAtivo.map((p) => <li key={p.id} className="flex justify-between"><span>{p.idadeControle} {p.unidadeIdade}</span><span>{toNumber(p.quantidadeCp) ?? 0} CP</span></li>)}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-slate-500">Padrão de moldagem <span className="font-bold text-slate-700 dark:text-slate-200">— traço não cadastrado, edite abaixo</span></span><span className="font-bold">{cpsAmostra} CP por amostra</span></div>
            <MoldingStandardEditor value={padraoEdit} onChange={setPadraoEdit} fck={row.fck_previsto ?? null} />
            <p className="mt-2 text-xs text-slate-500">Sem traço cadastrado, o padrão vem do default (NBR 5739: 28d e 63d, 2 CP cada). Ajuste as idades e a quantidade de CP — o valor é salvo nesta concretagem e usado para gerar os CPs.</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Volume programado (m³)" value={volume ?? '—'} readOnly />
          <Field label="Capacidade/caminhão (m³)" type="number" min={1} max={20} step="0.01" value={cap} onChange={(e) => setCap(e.target.value)} onBlur={(e) => setCap(clampNum(e.target.value, { min: 1, max: 20, dec: 2 })?.toString() ?? '')} hint="Base da estimativa de caminhões." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nº de amostras / caminhões" type="number" min={1} max={99} step="1" value={nAmostrasStr} onChange={(e) => { setNAmostrasTouched(true); setNAmostrasStr(e.target.value); }} onBlur={(e) => { const c = clampNum(e.target.value, { min: 1, max: 99, dec: 0 }); if (c == null) { setNAmostrasTouched(false); setNAmostrasStr(String(estAmostras)); } else { setNAmostrasStr(c.toString()); } }} hint={volume ? ('Estimado: ' + volume + ' m³ ÷ ' + capNum + ' = ' + estAmostras + ' caminhão(ões). Ajuste se amostrar menos caminhões.') : 'Informe o nº de amostras.'} />
          <Field label="Margem extra (%)" type="number" min={0} max={100} step="1" value={margem} onChange={(e) => setMargem(e.target.value)} onBlur={(e) => setMargem(clampNum(e.target.value, { min: 0, max: 100, dec: 0 })?.toString() ?? '0')} hint="Fôrmas a mais, por segurança (arredonda para cima)." />
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface-2)' }}>
          <p className="kicker">Fôrmas necessárias</p>
          <strong className="mt-1 block text-3xl font-extrabold tabular-nums" style={{ color: 'var(--magenta)' }}>{formasNecessarias}</strong>
          <p className="mt-1 text-xs text-slate-500">{cpsAmostra} CP × {nAmostras} amostra(s){margemPct > 0 ? ' + ' + margemPct + '% de margem' : ''}</p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">A entrega no estoque de fôrmas em campo é registrada automaticamente ao salvar a provisão (movimento automático por concretagem).</p>
      </div>
    </Modal>
  );
}
