import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from 'recharts';
import { useAuth } from '../../lib/auth';
import { clampNum } from '../../lib/validacao';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { Stat } from '../../components/ui/Stat';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { getConfigLab } from '../../lib/api/preferencias';
import { listCamaras, listCuraRegistros, curaConforme, upsertCuraRegistro } from '../../lib/api/cura';

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 12 } as const;
const hojeStr = () => new Date().toISOString().slice(0, 10);
const br = (d: string) => d.split('-').reverse().join('/');
const num = (v: unknown): number | null => { const s = String(v ?? '').trim(); if (!s) return null; const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function DiarioCuraPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [camaraId, setCamaraId] = useState('');
  const [data, setData] = useState(hojeStr());
  const [temp, setTemp] = useState('');
  const [calOk, setCalOk] = useState(true);
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  const cfgQ = useQuery({ queryKey: ['config-lab', member?.tenant_id], queryFn: () => getConfigLab(member!.tenant_id), enabled: !!member?.tenant_id });
  const min = Number(cfgQ.data?.camara_temp_min_c ?? 21);
  const max = Number(cfgQ.data?.camara_temp_max_c ?? 25);
  const camarasQ = useQuery({ queryKey: ['camaras'], queryFn: listCamaras });
  useEffect(() => { if (!camaraId && (camarasQ.data ?? []).length) setCamaraId(camarasQ.data![0].id); }, [camarasQ.data, camaraId]);
  const desde = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 45); return d.toISOString().slice(0, 10); }, []);
  const regQ = useQuery({ queryKey: ['cura-registros', camaraId, desde], queryFn: () => listCuraRegistros(camaraId, desde), enabled: !!camaraId });

  // Pré-carrega o registro existente do dia selecionado (edição idempotente).
  useEffect(() => {
    const ex = (regQ.data ?? []).find((r) => r.data === data);
    if (ex) { setTemp(ex.temperatura_c == null ? '' : String(ex.temperatura_c)); setCalOk(ex.cal_ok); setObs(ex.observacao ?? ''); }
    else { setTemp(''); setCalOk(true); setObs(''); }
  }, [data, regQ.data]);

  async function registrar() {
    if (!member || !camaraId) { toast('Selecione a câmara/tanque.', 'error'); return; }
    setBusy(true);
    try {
      const t = num(temp);
      const conforme = curaConforme(t, calOk, min, max);
      await upsertCuraRegistro(member.tenant_id, camaraId, { data, temperatura_c: t, cal_ok: calOk, conforme, observacao: obs || null });
      await qc.invalidateQueries({ queryKey: ['cura-registros', camaraId] });
      await qc.invalidateQueries({ queryKey: ['pendencias-badge'] });
      toast(conforme ? 'Registro salvo.' : 'Registro salvo — fora da faixa (gera pendência).', conforme ? 'success' : 'info');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function exportar() {
    const regs = regQ.data ?? [];
    if (!regs.length) return;
    const { exportExcel } = await import('../../lib/export/xlsx');
    const cam = (camarasQ.data ?? []).find((c) => c.id === camaraId);
    await exportExcel(
      { title: 'Diário de cura — ' + (cam?.apelido || cam?.marca_modelo || 'câmara'), subtitle: member?.tenant_name ?? undefined, fields: [{ label: 'Faixa aceitável', value: `${min}–${max} °C (NBR 9479)` }] },
      {
        name: 'Cura',
        columns: [
          { key: 'data', header: 'Data', width: 14 },
          { key: 'temperatura_c', header: 'Temperatura (°C)', width: 16 },
          { key: 'cal_ok', header: 'Água de cal', width: 14 },
          { key: 'conforme', header: 'Situação', width: 16 },
          { key: 'observacao', header: 'Observação', width: 34 },
        ],
        rows: regs.map((r) => ({ data: br(r.data), temperatura_c: r.temperatura_c == null ? '' : String(r.temperatura_c), cal_ok: r.cal_ok ? 'ok' : 'não', conforme: r.conforme ? 'conforme' : 'fora de faixa', observacao: r.observacao ?? '' })),
      },
    );
  }

  const regs = regQ.data ?? [];
  const chartData = regs.map((r) => ({ label: br(r.data).slice(0, 5), temp: r.temperatura_c }));
  const foraCount = regs.filter((r) => !r.conforme).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Qualidade do ensaio" title="Diário de cura (câmara úmida / tanque)" description="Registro diário de temperatura e água de cal, conforme NBR 9479 (cura a 23±2 °C). Câmaras e tanques são cadastrados em Equipamentos." />
      {camarasQ.isLoading ? <LoadingState /> : camarasQ.isError ? <ErrorState message={(camarasQ.error as Error).message} /> : (camarasQ.data ?? []).length === 0 ? (
        <Card className="p-6"><p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)' }}>Nenhuma câmara úmida ou tanque cadastrado. Cadastre em <b>Cadastros › Equipamentos</b> com o tipo “Câmara úmida” ou “Tanque de cura” para começar o diário.</p></Card>
      ) : (
        <>
          <Card className="p-5">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 200 }}><SelectField label="Câmara / tanque" required value={camaraId} onChange={(e) => setCamaraId(e.target.value)}>{(camarasQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.apelido || c.marca_modelo || 'sem nome'}</option>)}</SelectField></div>
              <div style={{ minWidth: 150 }}><Field label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
              <div style={{ maxWidth: 140 }}><Field label="Temperatura (°C)" type="number" min={0} max={50} step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} onBlur={(e) => setTemp(clampNum(e.target.value, { min: 0, max: 50, dec: 1 })?.toString() ?? '')} /></div>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={calOk} onChange={(e) => setCalOk(e.target.checked)} /> Água saturada de cal ok</label>
              <div style={{ flex: '1 1 180px', minWidth: 160 }}><Field label="Observação" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
              <Button busy={busy} onClick={() => void registrar()}>{busy ? 'Salvando...' : 'Registrar dia'}</Button>
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-faint)' }}>Faixa aceitável: {min}–{max} °C. Fora da faixa ou sem água de cal marca o dia como não conforme e gera pendência (últimos 7 dias). Ajuste a faixa em Preferências.</p>
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label="Registros (45 dias)" value={regs.length} />
            <Stat label="Fora de faixa" value={foraCount} detail={foraCount ? 'verifique a cura' : 'tudo conforme'} />
            <Stat label="Faixa NBR 9479" value={`${min}–${max} °C`} />
          </div>
          <Card>
            <CardHeader kicker="Tendência" title="Temperatura diária" />
            <div style={{ height: 280, padding: 12 }}>
              {regs.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -14 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                    <YAxis domain={[Math.min(min - 3, 15), Math.max(max + 3, 30)]} tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tipStyle} />
                    <ReferenceArea y1={min} y2={max} fill="#16a34a" fillOpacity={0.08} />
                    <ReferenceLine y={min} stroke="#16a34a" strokeDasharray="4 4" />
                    <ReferenceLine y={max} stroke="#16a34a" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="temp" stroke="#C5117E" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Sem registros ainda.</p>}
            </div>
          </Card>
          <Card className="p-5">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>Registros recentes</strong>
              {regs.length ? <Button variant="secondary" onClick={() => void exportar()}>Exportar Excel</Button> : null}
            </div>
            {regQ.isLoading ? <LoadingState /> : !regs.length ? <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Nenhum registro no período.</p> : (
              <div className="table-scroll">
                <table className="table">
                  <thead><tr><th>Data</th><th style={{ textAlign: 'right' }}>Temp (°C)</th><th>Água de cal</th><th>Situação</th><th>Observação</th></tr></thead>
                  <tbody>
                    {[...regs].reverse().map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{br(r.data)}</td>
                        <td style={{ textAlign: 'right' }}>{r.temperatura_c ?? '—'}</td>
                        <td>{r.cal_ok ? 'ok' : 'não'}</td>
                        <td style={{ fontWeight: 700, color: r.conforme ? 'var(--success)' : 'var(--magenta)' }}>{r.conforme ? 'conforme' : 'fora de faixa'}</td>
                        <td style={{ color: 'var(--ink-faint)' }}>{r.observacao ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
