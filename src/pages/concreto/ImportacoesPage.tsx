import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listConcretagensComPendentes, getPendentes, importarLote, importarResultadosDiretos, extrairOcr, type LinhaInput, type PendenteCP, type OcrResultado } from '../../lib/api/importacao';
import { calcMPa } from '../../lib/api/rompimento';

const hoje = () => new Date().toISOString().slice(0, 10);
type Row = { carga: string; d: string; h: string; tipo: string };
const fileToB64 = (file: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('falha ao ler arquivo')); r.readAsDataURL(file); });

function matchOcr(cps: PendenteCP[], resultados: OcrResultado[]): Record<string, string> {
  const used = new Set<number>();
  const out: Record<string, string> = {};
  for (const cp of cps) {
    const idx = resultados.findIndex((r, i) => !used.has(i) && Number(r.idade) === Number(cp.idade_dias) && (String(r.idade_unidade ?? 'dia').startsWith('h') ? 'hora' : 'dia') === cp.idade_unidade && Number(r.mpa) > 0);
    if (idx >= 0) { used.add(idx); out[cp.id] = String(resultados[idx].mpa); }
  }
  return out;
}

export function ImportacoesPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'manual' | 'ocr'>('manual');
  const [concId, setConcId] = useState('');
  const [data, setData] = useState(hoje());
  const [vals, setVals] = useState<Record<string, Row>>({});
  const [busy, setBusy] = useState(false);
  // OCR
  const [files, setFiles] = useState<File[]>([]);
  const [ocrVals, setOcrVals] = useState<Record<string, string>>({});
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);

  const concs = useQuery({ queryKey: ['imp-concs'], queryFn: listConcretagensComPendentes });
  const pend = useQuery({ queryKey: ['imp-pend', concId], queryFn: () => getPendentes(concId), enabled: !!concId });
  const cps = pend.data ?? [];

  function resetConc(id: string) { setConcId(id); setVals({}); setOcrVals({}); setOcrMsg(null); }
  function row(id: string): Row { return vals[id] ?? { carga: '', d: '100', h: '200', tipo: '' }; }
  function setRow(id: string, patch: Partial<Row>) { setVals((s) => ({ ...s, [id]: { ...row(id), ...patch } })); }

  async function lancarManual() {
    if (!member) return;
    const linhas: LinhaInput[] = [];
    for (const cp of cps) { const r = row(cp.id); const carga = Number(r.carga); if (!carga || carga <= 0) continue; linhas.push({ cp, carga_ruptura_kn: carga, cp_diametro_mm: Number(r.d) || 100, cp_altura_mm: Number(r.h) || 200, tipo_ruptura: r.tipo || undefined, data_rompimento: data }); }
    if (!linhas.length) { toast('Preencha a carga de ao menos um CP.', 'error'); return; }
    setBusy(true);
    try { const n = await importarLote(member.tenant_id, linhas); await invalida(); setVals({}); toast(n + ' resultado(s) lancado(s).', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function lerOcr() {
    if (!files.length) { toast('Selecione 1 a 4 imagens da folha de resultados.', 'error'); return; }
    setOcrBusy(true); setOcrMsg(null);
    try {
      const imgs = await Promise.all(files.slice(0, 4).map(async (f) => ({ base64: await fileToB64(f), mime: f.type || 'image/png' })));
      const r = await extrairOcr(imgs);
      if (!r.enabled) { setOcrMsg(r.reason ?? 'Leitura por IA indisponivel.'); setOcrVals({}); return; }
      const matched = matchOcr(cps, r.resultados);
      setOcrVals(matched);
      const n = Object.keys(matched).length;
      setOcrMsg(r.resultados.length + ' resultado(s) lido(s), ' + n + ' casado(s) por idade. Revise e importe.');
    } catch (e) { setOcrMsg((e as Error).message); } finally { setOcrBusy(false); }
  }
  async function importarOcr() {
    if (!member) return;
    const linhas = cps.map((cp) => ({ cp, mpa: Number(ocrVals[cp.id]) })).filter((l) => l.mpa > 0).map((l) => ({ cp: l.cp, mpa: l.mpa, data_rompimento: data }));
    if (!linhas.length) { toast('Nenhum MPa preenchido para importar.', 'error'); return; }
    setBusy(true);
    try { const n = await importarResultadosDiretos(member.tenant_id, linhas); await invalida(); setOcrVals({}); setFiles([]); toast(n + ' resultado(s) importado(s).', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function invalida() { await Promise.all([qc.invalidateQueries({ queryKey: ['imp-pend', concId] }), qc.invalidateQueries({ queryKey: ['imp-concs'] }), qc.invalidateQueries({ queryKey: ['agenda'] })]); }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Gestao" title="Importacoes" description="Lancamento de resultados em lote: manual ou por OCR (foto/scan)." />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant={mode === 'manual' ? 'primary' : 'ghost'} onClick={() => setMode('manual')}>Manual</Button>
        <Button variant={mode === 'ocr' ? 'primary' : 'ghost'} onClick={() => setMode('ocr')}>OCR (foto/scan)</Button>
      </div>
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280 }}>
            <SelectField label="Concretagem (com CPs pendentes)" value={concId} onChange={(e) => resetConc(e.target.value)}>
              <option value="">Selecione...</option>
              {(concs.data ?? []).map((c) => <option key={c.id} value={c.id}>{(c.codigo ?? c.id.slice(0, 8)) + ' - ' + (c.work_nome ?? '-')}</option>)}
            </SelectField>
          </div>
          <Field label="Data do rompimento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </Card>

      {!concId ? null : pend.isLoading ? <LoadingState /> : pend.isError ? <ErrorState message={(pend.error as Error).message} /> : cps.length === 0 ? <EmptyState /> : mode === 'manual' ? (
        <Card>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, padding: '0 4px' }}>
              <span style={{ width: 150 }}>CP</span><span style={{ width: 70 }}>Idade</span><span style={{ width: 90 }}>Carga kN</span><span style={{ width: 70 }}>d mm</span><span style={{ width: 70 }}>h mm</span><span style={{ width: 70 }}>Ruptura</span><span style={{ width: 80 }}>MPa</span>
            </div>
            {cps.map((cp) => {
              const r = row(cp.id);
              const prev = Number(r.carga) > 0 ? calcMPa(Number(r.carga), Number(r.d) || 100, Number(r.h) || 200) : null;
              return (
                <div key={cp.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 150, fontSize: 13 }}>{cp.codigo ?? cp.id.slice(0, 8)}</span>
                  <span style={{ width: 70, fontSize: 12, color: 'var(--ink-faint)' }}>{cp.idade_dias ?? '-'} {cp.idade_unidade === 'hora' ? 'h' : 'd'}</span>
                  <input type="number" className="input" style={{ width: 90 }} value={r.carga} onChange={(e) => setRow(cp.id, { carga: e.target.value })} />
                  <input type="number" className="input" style={{ width: 70 }} value={r.d} onChange={(e) => setRow(cp.id, { d: e.target.value })} />
                  <input type="number" className="input" style={{ width: 70 }} value={r.h} onChange={(e) => setRow(cp.id, { h: e.target.value })} />
                  <input className="input" style={{ width: 70 }} value={r.tipo} onChange={(e) => setRow(cp.id, { tipo: e.target.value })} />
                  <span style={{ width: 80, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{prev != null ? prev : '-'}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><Button onClick={() => void lancarManual()} disabled={busy}>{busy ? 'Lancando...' : 'Lancar lote'}</Button></div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              <Button onClick={() => void lerOcr()} disabled={ocrBusy}>{ocrBusy ? 'Lendo...' : 'Ler com IA'}</Button>
              {ocrMsg ? <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{ocrMsg}</span> : null}
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '8px 0 0' }}>Foto/scan da folha de resultados (ate 4 imagens). A IA le os MPa e casa por idade; voce revisa antes de importar.</p>
          </Card>
          <Card>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, padding: '0 4px' }}>
                <span style={{ width: 180 }}>CP</span><span style={{ width: 80 }}>Idade</span><span style={{ width: 110 }}>MPa (lido/edit)</span>
              </div>
              {cps.map((cp) => (
                <div key={cp.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 180, fontSize: 13 }}>{cp.codigo ?? cp.id.slice(0, 8)}</span>
                  <span style={{ width: 80, fontSize: 12, color: 'var(--ink-faint)' }}>{cp.idade_dias ?? '-'} {cp.idade_unidade === 'hora' ? 'h' : 'd'}</span>
                  <input type="number" className="input" style={{ width: 110 }} value={ocrVals[cp.id] ?? ''} onChange={(e) => setOcrVals((s) => ({ ...s, [cp.id]: e.target.value }))} />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><Button onClick={() => void importarOcr()} disabled={busy}>{busy ? 'Importando...' : 'Importar resultados'}</Button></div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
