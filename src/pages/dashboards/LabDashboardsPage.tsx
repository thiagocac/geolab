import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, PieChart, Pie, Legend, ComposedChart, ReferenceLine } from 'recharts';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { exportExcel } from '../../lib/export/xlsx';
import { getLabDashboardSnapshot, emptySnapshot, cartaControleOpcoes, getCartaControle, type LabDashboardSnapshot, type SeriePoint, type RankingRow, type CartaScope } from '../../lib/api/dashboards';
import { getDashboardQualidadeV2, emptyQualidadeV2, type QualidadeV2 } from '../../lib/api/dashboardV2';
import { getDashboardBusiness, type DashboardBusiness } from '../../lib/api/dashboardBusiness';
import { getDashboardOps, type DashboardOps, type OpsPoint } from '../../lib/api/dashboardOps';
import { useDashboardFilters } from '../../lib/dashboard/filters';
import { DashboardShell, DashboardFilterBar } from '../../components/dashboard/DashboardShell';
import { ChartPanel } from '../../components/dashboard/ChartPanel';
import { HeatmapMatrix } from '../../components/dashboard/HeatmapMatrix';

/**
 * Dashboard v2 (DASH-F1, v213) — hub de gestão em tela cheia.
 * - Filtros (período/cliente/obra) persistidos na URL e aplicados ao snapshot (a RPC já aceitava
 *   client_id/work_id; a v1 da tela não enviava).
 * - Painéis de qualidade alimentados pela RPC dashboard_qualidade_v2 (mig 206) — antes liam
 *   chaves que o snapshot nunca retornou (gráfico eternamente vazio).
 * - Excluídos da fase 1 (sem fonte de dados agregada ainda; voltam no DASH-F2 com seus módulos):
 *   nc, docgate, equipamentos, produtividade, contratos, risco.
 * - Drill-down: gráficos/KPIs navegam para /rompimentos?janela=… e /gestao/pendencias.
 */

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 12 } as const;
const palette = ['#182863', '#C5117E', '#3E2D71', '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#64748b'];

type DashId =
  | 'exec' | 'qualidade' | 'rompimentos' | 'resistencia' | 'insatisfatorios' | 'altas' | 'variacao' | 'carta_controle'
  | 'slump' | 'fornecedores' | 'obras' | 'logistica' | 'sla' | 'pendencias' | 'financeiro' | 'negocio'
  | 'risco' | 'nc' | 'equipamentos' | 'produtividade' | 'docgate' | 'contratos';

type Dash = { id: DashId; titulo: string; grupo: string; desc: string; exportavel?: boolean };
const dashboards: Dash[] = [
  { id: 'exec', titulo: 'Executivo do laboratório', grupo: 'Direção', desc: 'Volume, conformidade, laudos, receita e riscos operacionais.', exportavel: true },
  { id: 'negocio', titulo: 'Negócio e caixa', grupo: 'Direção', desc: 'Funil comercial, contratos, medições, caixa, compras, estoque e conciliação.', exportavel: true },
  { id: 'risco', titulo: 'Radar de riscos', grupo: 'Direção', desc: 'Calibração, certificações, NCs, atrasos, documentos e títulos vencidos em um só lugar.', exportavel: true },
  { id: 'qualidade', titulo: 'Qualidade e aceitação', grupo: 'Qualidade', desc: 'Conformidade na idade de controle e obras com insatisfatórios.', exportavel: true },
  { id: 'insatisfatorios', titulo: 'Resultados insatisfatórios', grupo: 'Qualidade', desc: 'Exemplares abaixo do fck apenas na idade de controle.', exportavel: true },
  { id: 'altas', titulo: 'Altas resistências', grupo: 'Qualidade', desc: 'Resultados muito acima do fck — possível traço conservador.', exportavel: true },
  { id: 'variacao', titulo: 'Variação e dispersão', grupo: 'Qualidade', desc: 'Coeficiente de variação mensal e mapa fck × obra.', exportavel: true },
  { id: 'carta_controle', titulo: 'Carta de controle (X̄-R)', grupo: 'Qualidade', desc: 'Média e amplitude do par na idade de controle, limites 3σ (Shewhart n=2).' },
  { id: 'nc', titulo: 'Não conformidades', grupo: 'Qualidade', desc: 'NCs abertas por severidade, evolução mensal e ocorrências recentes.', exportavel: true },
  { id: 'resistencia', titulo: 'Curva de resistência', grupo: 'Técnico', desc: 'Evolução 7d/28d contra o fck e dispersão por traço.', exportavel: true },
  { id: 'equipamentos', titulo: 'Equipamentos e calibração', grupo: 'Técnico', desc: 'Vencimento de calibrações e verificações intermediárias da prensa.', exportavel: true },
  { id: 'rompimentos', titulo: 'Agenda de rompimentos', grupo: 'Operação', desc: 'Atrasados, hoje, próximos 7 dias e backlog por idade.', exportavel: true },
  { id: 'pendencias', titulo: 'Pendências e lançamentos', grupo: 'Operação', desc: 'CPs sem resultado, laudos sem emissão e fila crítica.', exportavel: true },
  { id: 'produtividade', titulo: 'Produtividade da equipe', grupo: 'Operação', desc: 'CPs moldados, rompimentos, laudos e retrabalho por colaborador.', exportavel: true },
  { id: 'docgate', titulo: 'Documentos e gate', grupo: 'Operação', desc: 'Documentos obrigatórios: pendentes, vencidos e próximos vencimentos.', exportavel: true },
  { id: 'sla', titulo: 'SLA do laboratório', grupo: 'Operação', desc: 'Prazos reais: moldagem → recebimento, rompimento no dia e emissão do laudo.', exportavel: true },
  { id: 'slump', titulo: 'Slump e recebimento', grupo: 'Campo', desc: 'Abatimento medido (mm) contra o previsto do traço.', exportavel: true },
  { id: 'logistica', titulo: 'Logística do caminhão', grupo: 'Campo', desc: 'Tempo médio de transporte e descarga a partir dos horários da ficha.', exportavel: true },
  { id: 'fornecedores', titulo: 'Fornecedores / concreteiras', grupo: 'Fornecedor', desc: 'Ranking por volume e conformidade.', exportavel: true },
  { id: 'obras', titulo: 'Scorecard por obra', grupo: 'Cliente', desc: 'Ranking de obras com volume e conformidade.', exportavel: true },
  { id: 'financeiro', titulo: 'Financeiro do laboratório', grupo: 'Financeiro', desc: 'Medição × faturamento × aberto no período.', exportavel: true },
  { id: 'contratos', titulo: 'Contratos e consumo', grupo: 'Financeiro', desc: 'Consumo do limite contratado, saldo a medir e vigências.', exportavel: true },
];
const QUALITY_PANELS = new Set<DashId>(['qualidade', 'resistencia', 'insatisfatorios', 'altas', 'variacao']);
const OPS_PANELS = new Set<DashId>(['risco', 'nc', 'equipamentos', 'produtividade', 'docgate', 'contratos', 'sla', 'logistica']);

function n(snapshot: LabDashboardSnapshot, key: string) { return Number(snapshot.kpis[key] ?? 0); }
function money(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function pct(v: number) { return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`; }
function series(s: LabDashboardSnapshot, key: string): SeriePoint[] { return s.series[key] ?? []; }
function rank(s: LabDashboardSnapshot, key: string): RankingRow[] { return s.rankings[key] ?? []; }

function Bars({ data, dataKey = 'valor' }: { data: Array<Record<string, unknown>>; dataKey?: string }) { return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} /><YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tipStyle} /><Bar dataKey={dataKey} radius={[7, 7, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Bar></BarChart></ResponsiveContainer>; }
function Lines({ data, keys }: { data: Array<Record<string, unknown>>; keys: string[] }) { return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} /><YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />{keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2.5} dot={false} />)}</LineChart></ResponsiveContainer>; }
function Donut({ data }: { data: Array<Record<string, unknown>> }) { return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="valor" nameKey="label" innerRadius="52%" outerRadius="78%" paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie><Tooltip contentStyle={tipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>; }
function Ranking({ data, onRowClick }: { data: RankingRow[]; onRowClick?: (r: RankingRow) => void }) { return <div className="grid gap-2">{data.slice(0, 12).map((r, i) => { const inner = <><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-800 dark:text-slate-100">{i + 1}. {r.nome}</span><span className="font-black tabular-nums text-slate-950 dark:text-slate-50">{r.taxa != null ? pct(r.taxa) : r.valor.toLocaleString('pt-BR')}</span></div>{r.detalhe ? <p className="mt-1 text-xs text-slate-500">{r.detalhe}</p> : null}</>; return onRowClick ? <button key={r.id ?? r.nome} type="button" onClick={() => onRowClick(r)} className="rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600">{inner}</button> : <div key={r.id ?? r.nome} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">{inner}</div>; })}</div>; }
function StatButton({ label, value, detail, onClick }: { label: string; value: string | number; detail?: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="text-left transition hover:opacity-80"><Stat label={label} value={value} detail={detail} /></button>; }
function PanelPlaceholder({ title, children }: { title: string; children: ReactNode }) { return <Card><CardHeader kicker="Em preparação" title={title} /><div className="p-6 text-sm text-slate-600 dark:text-slate-300">{children}</div></Card>; }

function Panel({ id, snapshot, qualidade, nav }: { id: DashId; snapshot: LabDashboardSnapshot; qualidade: QualidadeV2; nav: (to: string) => void }) {
  const qualidadeMensal = series(snapshot, 'qualidade_mensal');
  const volume = series(snapshot, 'volume_mensal');
  if (id === 'exec') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <Stat label="Volume recebido" value={n(snapshot, 'volume_m3').toLocaleString('pt-BR')} detail="m³ no período" />
      <Stat label="Ensaios" value={n(snapshot, 'ensaios').toLocaleString('pt-BR')} detail={`${n(snapshot, 'ensaios_controle').toLocaleString('pt-BR')} na idade de controle`} />
      <Stat label="Conformidade" value={pct(n(snapshot, 'taxa_conformidade'))} detail="idade de controle" />
      <Stat label="Receita medida" value={money(n(snapshot, 'receita_medida'))} />
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2"><ChartPanel title="Volume e ensaios por mês" empty={!volume.length}><Lines data={volume as never} keys={['volume', 'ensaios']} /></ChartPanel></div>
      <ChartPanel title="Status de laudos" action={{ label: 'Abrir laudos', onClick: () => nav('/laudos') }} empty={!series(snapshot, 'laudos_status').length}><Donut data={series(snapshot, 'laudos_status') as never} /></ChartPanel>
    </div>
  </>;
  if (id === 'qualidade') return <div className="grid gap-4 xl:grid-cols-3">
    <div className="xl:col-span-2"><ChartPanel title="Conformidade mensal na idade de controle" empty={!qualidadeMensal.length}><Lines data={qualidadeMensal as never} keys={['conforme', 'nao_conforme']} /></ChartPanel></div>
    <Card><CardHeader title="Obras com insatisfatórios" kicker="Qualidade" /><div className="p-4">{qualidade.insatisfatorios_obra.length ? <Ranking data={qualidade.insatisfatorios_obra as RankingRow[]} onRowClick={(r) => nav(r.id ? `/rompimentos?janela=insatisfatorios&obra_id=${r.id}` : '/rompimentos?janela=insatisfatorios')} /> : <p className="text-sm text-emerald-700 dark:text-emerald-400">Nenhuma obra com resultado abaixo do fck no período. ✓</p>}</div></Card>
  </div>;
  if (id === 'rompimentos') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <StatButton label="Atrasados" value={n(snapshot, 'rompimentos_atrasados')} detail="abrir agenda filtrada" onClick={() => nav('/rompimentos?janela=atrasados')} />
      <StatButton label="Hoje" value={n(snapshot, 'rompimentos_hoje')} detail="abrir agenda de hoje" onClick={() => nav('/rompimentos?janela=hoje')} />
      <Stat label="Próximos 7 dias" value={n(snapshot, 'rompimentos_7d')} />
      <StatButton label="Sem resultado" value={n(snapshot, 'cp_sem_resultado')} detail="abrir pendentes" onClick={() => nav('/rompimentos?janela=pendentes')} />
    </div>
    <ChartPanel title="Agenda por idade" action={{ label: 'Abrir agenda completa', onClick: () => nav('/rompimentos') }} empty={!series(snapshot, 'agenda_idades').length}><Bars data={series(snapshot, 'agenda_idades') as never} /></ChartPanel>
  </>;
  if (id === 'resistencia') return <div className="grid gap-4 xl:grid-cols-2">
    <ChartPanel title="Curva 7d / 28d / fck" empty={!series(snapshot, 'curva_resistencia').length}><Lines data={series(snapshot, 'curva_resistencia') as never} keys={['sete_dias', 'vinte_oito_dias', 'meta']} /></ChartPanel>
    <ChartPanel title="Dispersão por traço (CV %)" note="Coeficiente de variação dos resultados na idade de controle — quanto menor, mais estável o processo." empty={!qualidade.dispersao_tracos.length}><Bars data={qualidade.dispersao_tracos.map((t) => ({ label: t.nome, valor: t.valor })) as never} /></ChartPanel>
  </div>;
  if (id === 'insatisfatorios') return <div className="grid gap-4 xl:grid-cols-3">
    <div className="xl:col-span-2"><ChartPanel title="Insatisfatórios por mês (idade de controle)" action={{ label: 'Ver no Rompimentos', onClick: () => nav('/rompimentos?janela=insatisfatorios') }} empty={!qualidade.insatisfatorios_mensal.length}><Bars data={qualidade.insatisfatorios_mensal as never} /></ChartPanel></div>
    <Card><CardHeader title="Exemplares críticos por obra" kicker="Ação técnica" /><div className="p-4">{qualidade.insatisfatorios_obra.length ? <Ranking data={qualidade.insatisfatorios_obra as RankingRow[]} onRowClick={(r) => nav(r.id ? `/rompimentos?janela=insatisfatorios&obra_id=${r.id}` : '/rompimentos?janela=insatisfatorios')} /> : <p className="text-sm text-emerald-700 dark:text-emerald-400">Nenhum insatisfatório no período. ✓</p>}</div></Card>
  </div>;
  if (id === 'altas') return <div className="grid gap-4 xl:grid-cols-3">
    <div className="xl:col-span-2"><ChartPanel title="Resultados ≥ 140% do fck por mês" note="Consistentemente muito acima do fck pode indicar traço conservador — oportunidade de otimização de custo do cliente." empty={!qualidade.altas_mensal.length}><Bars data={qualidade.altas_mensal as never} /></ChartPanel></div>
    <Card><CardHeader title="Traços com possível excesso" kicker="Otimização" /><div className="p-4">{qualidade.tracos_altos.length ? <Ranking data={qualidade.tracos_altos as RankingRow[]} /> : <p className="text-sm text-slate-500">Nenhum traço com média ≥ 120% do fck no período.</p>}</div></Card>
  </div>;
  if (id === 'variacao') return <div className="grid gap-4 xl:grid-cols-2">
    <ChartPanel title="Coeficiente de variação mensal (%)" empty={!qualidade.variacao_mensal.length}><Lines data={qualidade.variacao_mensal as never} keys={['valor']} /></ChartPanel>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="kicker mb-3">Mapa fck × obra — média do resultado sobre o fck (%)</p><HeatmapMatrix cells={qualidade.heatmap_fck_obra} valueFmt={(v) => `${v}%`} /><p className="mt-2 text-xs text-slate-500">100% = resultado médio exatamente no fck; abaixo de 100% exige atenção; muito acima pode ser traço conservador.</p></div>
  </div>;
  if (id === 'slump') return <ChartPanel title="Slump médio mensal (mm)" note="Abatimento em milímetros (NBR 16889). A linha é o previsto médio dos traços." empty={!series(snapshot, 'slump_mensal').length}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series(snapshot, 'slump_mensal') as never}><CartesianGrid stroke="var(--line)" /><XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} /><Tooltip contentStyle={tipStyle} /><Bar dataKey="valor" fill="#182863" radius={[7, 7, 0, 0]} /><Line dataKey="meta" stroke="#C5117E" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></ChartPanel>;
  if (id === 'fornecedores') return <div className="grid gap-4 xl:grid-cols-2">
    <ChartPanel title="Volume por concreteira" empty={!rank(snapshot, 'fornecedores_volume').length}><Bars data={rank(snapshot, 'fornecedores_volume').map((r) => ({ label: r.nome, valor: r.valor })) as never} /></ChartPanel>
    <Card><CardHeader title="Ranking por conformidade" kicker="Fornecedor" /><div className="p-4"><Ranking data={rank(snapshot, 'fornecedores_conformidade')} /></div></Card>
  </div>;
  if (id === 'obras') return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader title="Scorecard por obra" kicker="Cliente" /><div className="p-4"><Ranking data={rank(snapshot, 'obras_scorecard')} /></div></Card>
    <ChartPanel title="Volume por obra" empty={!rank(snapshot, 'obras_volume').length}><Bars data={rank(snapshot, 'obras_volume').map((r) => ({ label: r.nome, valor: r.valor })) as never} /></ChartPanel>
  </div>;
  if (id === 'pendencias') return <div className="grid gap-4 xl:grid-cols-3">
    <div className="xl:col-span-2"><ChartPanel title="Pendências por tipo" action={{ label: 'Abrir pendências', onClick: () => nav('/gestao/pendencias') }} empty={!series(snapshot, 'pendencias_tipo').length}><Bars data={series(snapshot, 'pendencias_tipo') as never} /></ChartPanel></div>
    <Card><CardHeader title="Fila crítica" kicker="Operação" /><div className="p-4"><Ranking data={rank(snapshot, 'pendencias_criticas')} /></div></Card>
  </div>;
  if (id === 'financeiro') return <ChartPanel title="Medição × faturamento × aberto" action={{ label: 'Abrir financeiro', onClick: () => nav('/financeiro?tab=contratos') }} empty={!snapshot.finance.length}><Lines data={snapshot.finance as never} keys={['previsto', 'realizado', 'aberto']} /></ChartPanel>;
  return <PanelPlaceholder title={String(id)}>Painel em preparação.</PanelPlaceholder>;
}

const sevTone: Record<string, string> = {
  alto: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200',
  medio: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
  baixo: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200',
};
function diasBadge(dias: number | null) {
  if (dias == null) return <span className="text-xs text-slate-400">sem validade</span>;
  if (dias < 0) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">vencido há {Math.abs(dias)}d</span>;
  if (dias <= 30) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{dias}d</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{dias}d</span>;
}

function OpsPanel({ id, ops, nav }: { id: DashId; ops: DashboardOps; nav: (to: string) => void }) {
  if (id === 'risco') {
    const itens = [...ops.risco.itens].sort((a, b) => (b.value > 0 ? 1 : 0) - (a.value > 0 ? 1 : 0) || (a.severity === 'alto' ? -1 : 1) - (b.severity === 'alto' ? -1 : 1) || b.value - a.value);
    return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {itens.map((r) => <button key={r.key} type="button" onClick={() => nav(r.route)} className={'rounded-2xl border p-4 text-left transition hover:opacity-90 ' + (r.value > 0 ? sevTone[r.severity] : sevTone.baixo)}>
        <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold">{r.label}</p><span className="text-2xl font-black tabular-nums">{r.value}</span></div>
        <p className="mt-1 text-xs opacity-80">{r.value === 0 ? 'Nenhuma ocorrência ✓' : r.amount != null ? money(r.amount) + ' em aberto' : r.severity === 'alto' ? 'Ação imediata recomendada' : 'Acompanhar'}</p>
      </button>)}
    </div>;
  }
  if (id === 'nc') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <StatButton label="Abertas" value={ops.nc.kpis.abertas ?? 0} detail="todas as NCs em aberto" onClick={() => nav('/nc')} />
      <Stat label="Severidade alta" value={ops.nc.kpis.criticas ?? 0} />
      <Stat label="Abertas no período" value={ops.nc.kpis.abertas_periodo ?? 0} />
      <Stat label="Resolvidas no período" value={ops.nc.kpis.resolvidas_periodo ?? 0} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="NCs abertas por mês" action={{ label: 'Abrir NCs', onClick: () => nav('/nc') }} empty={!ops.nc.mensal.length}><Bars data={ops.nc.mensal as never} dataKey="value" /></ChartPanel>
      <ChartPanel title="Por classificação (período)" empty={!ops.nc.por_classificacao.length}><Bars data={ops.nc.por_classificacao as never} dataKey="value" /></ChartPanel>
    </div>
    <Card><CardHeader kicker="Qualidade" title="Ocorrências recentes" /><div className="grid gap-2 p-4 md:grid-cols-2">
      {ops.nc.recentes.length ? ops.nc.recentes.map((r) => <button key={r.id} type="button" onClick={() => nav('/nc')} className="rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900 dark:text-slate-50">{r.numero ?? 'NC'} · {r.tipo ?? 'sem tipo'}</p><p className="mt-1 text-xs text-slate-500">{r.obra ?? 'Sem obra'} · {r.data_abertura ?? ''}</p></div><span className={'rounded-full px-2 py-0.5 text-xs font-bold ' + (r.severidade === 'alta' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>{r.severidade ?? '—'}</span></div></button>) : <p className="text-sm text-emerald-700 dark:text-emerald-400">Nenhuma NC registrada. ✓</p>}
    </div></Card>
  </>;
  if (id === 'equipamentos') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <StatButton label="Equipamentos ativos" value={ops.equipamentos.kpis.ativos ?? 0} detail="abrir cadastro" onClick={() => nav('/equipamentos')} />
      <Stat label="Calibração vencida" value={ops.equipamentos.kpis.calibracao_vencida ?? 0} />
      <Stat label="Vencendo em 30 dias" value={ops.equipamentos.kpis.calibracao_30d ?? 0} />
      <Stat label="Verificação em atraso" value={ops.equipamentos.kpis.verificacao_atrasada ?? 0} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader kicker="Calibração" title="Próximos vencimentos" /><div className="grid gap-2 p-4">
        {ops.equipamentos.calibracoes.length ? ops.equipamentos.calibracoes.map((c) => <button key={c.id} type="button" onClick={() => nav('/equipamentos')} className="rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600"><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-slate-900 dark:text-slate-50">{c.label}</p><p className="mt-0.5 text-xs text-slate-500">{c.tipo ?? ''} · validade {c.validade ?? '—'}</p></div>{diasBadge(c.dias)}</div></button>) : <p className="text-sm text-slate-500">Nenhum equipamento ativo.</p>}
      </div></Card>
      <ChartPanel title="Verificações intermediárias por mês" empty={!ops.equipamentos.verificacoes_mensal.length}><Lines data={ops.equipamentos.verificacoes_mensal as never} keys={['conformes', 'nao_conformes']} /></ChartPanel>
    </div>
  </>;
  if (id === 'produtividade') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <Stat label="CPs moldados" value={(ops.produtividade.kpis.cps_moldados ?? 0).toLocaleString('pt-BR')} detail="no período" />
      <Stat label="Rompimentos" value={(ops.produtividade.kpis.rompimentos ?? 0).toLocaleString('pt-BR')} />
      <StatButton label="Laudos emitidos" value={ops.produtividade.kpis.laudos_emitidos ?? 0} detail="abrir laudos" onClick={() => nav('/laudos')} />
      <Stat label="Retrabalho" value={pct(ops.produtividade.kpis.retrabalho_pct ?? 0)} detail="resultados corrigidos (R>1)" />
    </div>
    <ChartPanel title="Produção mensal" empty={!ops.produtividade.mensal.length}><Lines data={ops.produtividade.mensal as never} keys={['moldados', 'rompidos', 'laudos']} /></ChartPanel>
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="CPs moldados por moldador" empty={!ops.produtividade.moldadores.length}><Bars data={ops.produtividade.moldadores as never} dataKey="value" /></ChartPanel>
      <ChartPanel title="Rompimentos por operador" empty={!ops.produtividade.operadores.length}><Bars data={ops.produtividade.operadores as never} dataKey="value" /></ChartPanel>
    </div>
  </>;
  if (id === 'docgate') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <StatButton label="Pendentes de análise" value={ops.docgate.kpis.pendentes ?? 0} detail="abrir documentos" onClick={() => nav('/gestao/documentos')} />
      <Stat label="Vencidos" value={ops.docgate.kpis.vencidos ?? 0} />
      <Stat label="Vencendo em 30 dias" value={ops.docgate.kpis.vencendo_30d ?? 0} />
      <Stat label="Aprovados" value={ops.docgate.kpis.aprovados ?? 0} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="Documentos por status" empty={!ops.docgate.por_status.length}><Bars data={ops.docgate.por_status as never} dataKey="value" /></ChartPanel>
      <Card><CardHeader kicker="Gate documental" title="Próximos vencimentos" /><div className="grid gap-2 p-4">
        {ops.docgate.vencimentos.length ? ops.docgate.vencimentos.map((d) => <button key={d.id} type="button" onClick={() => nav('/gestao/documentos')} className="rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600"><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-slate-900 dark:text-slate-50">{d.titulo}</p><p className="mt-0.5 text-xs text-slate-500">{d.status} · validade {d.data_validade ?? '—'}</p></div>{diasBadge(d.dias)}</div></button>) : <p className="text-sm text-slate-500">Nenhum documento com validade cadastrada.</p>}
      </div></Card>
    </div>
  </>;
  if (id === 'contratos') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <StatButton label="Contratos ativos" value={ops.contratos.kpis.ativos ?? 0} detail="abrir contratos" onClick={() => nav('/gestao/contratos-v2')} />
      <Stat label="Consumo médio" value={pct(ops.contratos.kpis.consumo_medio_pct ?? 0)} detail="dos limites contratados" />
      <Stat label="Saldo a medir" value={money(ops.contratos.kpis.saldo_total ?? 0)} />
      <Stat label="Vencendo em 90 dias" value={ops.contratos.kpis.vencendo_90d ?? 0} />
    </div>
    <ChartPanel title="Consumo do limite por contrato (%)" action={{ label: 'Abrir contratos', onClick: () => nav('/gestao/contratos-v2') }} empty={!ops.contratos.consumo.length}><Bars data={ops.contratos.consumo as never} dataKey="value" /></ChartPanel>
    <Card><CardHeader kicker="Financeiro" title="Balanço contratado × medido × faturado" /><div className="grid gap-2 p-4 md:grid-cols-2">
      {ops.contratos.balanco.length ? ops.contratos.balanco.map((c) => { const cons = Math.max(0, Math.min(100, c.consumo_pct ?? 0)); return <button key={c.id} type="button" onClick={() => nav('/gestao/contratos-v2')} className="rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600">
        <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900 dark:text-slate-50">{c.numero ?? 'Contrato'}</p><p className="mt-0.5 text-xs text-slate-500">{c.cliente ?? 'Sem cliente'} · vigência até {c.vigencia_fim ?? '—'}</p></div><span className="font-black tabular-nums">{c.consumo_pct != null ? pct(c.consumo_pct) : '—'}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={'h-full rounded-full ' + (cons >= 90 ? 'bg-red-500' : cons >= 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: cons + '%' }} /></div>
        <p className="mt-1.5 text-xs text-slate-500">Limite {money(c.valor_limite)} · medido {money(c.valor_medido)} · faturado {money(c.valor_faturado)} · saldo {money(c.saldo_a_medir)}</p>
      </button>; }) : <p className="text-sm text-slate-500">Nenhum contrato com valores cadastrados.</p>}
    </div></Card>
  </>;
  if (id === 'sla') return <>
    <div className="grid gap-3 md:grid-cols-4">
      <Stat label="Moldagem → recebimento" value={(ops.sla.kpis.media_dias_recebimento ?? 0) + 'd'} detail="média no período" />
      <Stat label="Rompimento no dia" value={pct(ops.sla.kpis.pct_rompimento_no_dia ?? 0)} detail="real = previsto" />
      <Stat label="Desvio do rompimento" value={(ops.sla.kpis.media_desvio_rompimento ?? 0) + 'd'} detail="média real − previsto" />
      <Stat label="Rompimento → laudo" value={(ops.sla.kpis.media_dias_emissao_laudo ?? 0) + 'd'} detail="média até a emissão" />
    </div>
    <ChartPanel title="Prazos médios por mês (dias)" note="Recebimento no lab, desvio do rompimento e emissão do laudo — quanto menor, melhor." empty={!ops.sla.mensal.length}><Lines data={ops.sla.mensal as never} keys={['recebimento', 'desvio_rompimento', 'emissao_laudo']} /></ChartPanel>
  </>;
  const cobertura = (ops.logistica.kpis.total_caminhoes ?? 0) > 0 ? Math.round(100 * (ops.logistica.kpis.caminhoes_com_horario ?? 0) / (ops.logistica.kpis.total_caminhoes ?? 1)) : 0;
  return <>
    <div className="grid gap-3 md:grid-cols-4">
      <Stat label="Transporte médio" value={(ops.logistica.kpis.media_transporte_min ?? 0) + ' min'} detail="usina → obra" />
      <Stat label="Descarga média" value={(ops.logistica.kpis.media_descarga_min ?? 0) + ' min'} detail="início → fim" />
      <Stat label="Caminhões no período" value={ops.logistica.kpis.total_caminhoes ?? 0} />
      <Stat label="Com horários preenchidos" value={pct(cobertura)} detail={(ops.logistica.kpis.caminhoes_com_horario ?? 0) + ' de ' + (ops.logistica.kpis.total_caminhoes ?? 0)} />
    </div>
    <ChartPanel title="Tempos médios por mês (min)" note="Calculado dos horários preenchidos na ficha de cada caminhão. Preencha os horários para ampliar a cobertura." empty={!ops.logistica.mensal.length}><Lines data={ops.logistica.mensal as never} keys={['transporte', 'descarga']} /></ChartPanel>
  </>;
}

function BusinessPanel({ data, nav }: { data: DashboardBusiness; nav: (to: string) => void }) {
  const k = data.kpis;
  return <>
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatButton label="Pipeline ponderado" value={money(k.crm_weighted ?? 0)} detail={`${k.crm_open ?? 0} oportunidade(s)`} onClick={() => nav('/crm')} />
      <StatButton label="Contratos ativos" value={k.contracts_active ?? 0} detail={`${k.proposals_sent ?? 0} proposta(s) no período`} onClick={() => nav('/gestao/contratos-v2')} />
      <StatButton label="Valor medido" value={money(k.measured ?? 0)} detail="no período" onClick={() => nav('/gestao/medicoes-v2')} />
      <StatButton label="A receber" value={money(k.receivable_open ?? 0)} detail={`${k.overdue_receivables ?? 0} vencido(s)`} onClick={() => nav('/gestao/fluxo-caixa')} />
      <StatButton label="A pagar" value={money(k.payable_open ?? 0)} detail={`${k.purchase_open ?? 0} pedido(s) aberto(s)`} onClick={() => nav('/gestao/compras')} />
      <StatButton label="Conciliação pendente" value={k.bank_pending ?? 0} detail={`${k.stock_low ?? 0} item(ns) abaixo do mínimo`} onClick={() => nav('/gestao/conciliacao')} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="Funil comercial" action={{ label: 'Abrir CRM', onClick: () => nav('/crm') }} empty={!data.crm_by_stage.length}><Bars data={data.crm_by_stage as never} dataKey="amount" /></ChartPanel>
      <ChartPanel title="Fluxo de caixa realizado" action={{ label: 'Abrir fluxo de caixa', onClick: () => nav('/gestao/fluxo-caixa') }} empty={!data.cashflow_monthly.length}><Lines data={data.cashflow_monthly as never} keys={['receitas', 'despesas', 'saldo']} /></ChartPanel>
      <ChartPanel title="Carga operacional — próximos 7 dias" action={{ label: 'Abrir planejamento', onClick: () => nav('/planejamento-semanal') }} empty={!data.operations_week.length}><Lines data={data.operations_week as never} keys={['programacoes', 'rupturas']} /></ChartPanel>
      <ChartPanel title="Compras por status" action={{ label: 'Abrir compras', onClick: () => nav('/gestao/compras') }} empty={!data.purchases_by_status.length}><Bars data={data.purchases_by_status as never} /></ChartPanel>
    </div>
    <Card>
      <CardHeader kicker="Financeiro" title="Maiores valores em aberto" />
      <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
        {data.top_receivables.length ? data.top_receivables.map((row) => <button key={row.id} type="button" onClick={() => nav('/gestao/fluxo-caixa')} className="rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900 dark:text-slate-50">{row.descricao}</p><p className="mt-1 text-xs text-slate-500">{row.client_name ?? 'Cliente não vinculado'} · venc. {row.data_vencimento ?? '—'}</p></div><strong className="whitespace-nowrap tabular-nums">{money(row.open_amount)}</strong></div></button>) : <p className="text-sm text-emerald-700 dark:text-emerald-400">Nenhum recebível em aberto.</p>}
      </div>
    </Card>
    <div className="grid gap-3 md:grid-cols-4">
      <Stat label="Onboarding" value={`${k.onboarding_progress ?? 0}%`} detail="configuração do laboratório" />
      <Stat label="Programações na semana" value={k.week_programacoes ?? 0} />
      <Stat label="Rompimentos na semana" value={k.week_rupturas ?? 0} />
      <Stat label="Estoque abaixo do mínimo" value={k.stock_low ?? 0} />
    </div>
  </>;
}

function CartaControlePanel({ from, to }: { from: string; to: string }) {
  const [scope, setScope] = useState<CartaScope>('traco');
  const [tracoId, setTracoId] = useState('');
  const [obraId, setObraId] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const opcoesQ = useQuery({ queryKey: ['carta-opcoes'], queryFn: cartaControleOpcoes });
  const alvoId = scope === 'traco' ? tracoId : scope === 'obra' ? obraId : null;
  const alvoForn = scope === 'fornecedor' ? fornecedor : null;
  const pronto = scope === 'fornecedor' ? !!alvoForn : !!alvoId;
  const cartaQ = useQuery({ queryKey: ['carta-controle', scope, alvoId, alvoForn, from, to], queryFn: () => getCartaControle(scope, alvoId, alvoForn, from, to), enabled: pronto });
  const c = cartaQ.data;
  const dados = (c?.pontos ?? []).map((p) => ({ ...p }));
  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 p-5 md:grid-cols-[180px_1fr]">
          <SelectField label="Agrupar por" value={scope} onChange={(e) => setScope(e.target.value as CartaScope)}>
            <option value="traco">Traço</option><option value="obra">Obra</option><option value="fornecedor">Fornecedor</option>
          </SelectField>
          {scope === 'traco' ? <SelectField label="Traço" value={tracoId} onChange={(e) => setTracoId(e.target.value)}><option value="">Selecione…</option>{(opcoesQ.data?.tracos ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</SelectField>
           : scope === 'obra' ? <SelectField label="Obra" value={obraId} onChange={(e) => setObraId(e.target.value)}><option value="">Selecione…</option>{(opcoesQ.data?.obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</SelectField>
           : <SelectField label="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}><option value="">Selecione…</option>{(opcoesQ.data?.fornecedores ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</SelectField>}
        </div>
      </Card>
      {!pronto ? <Card><div className="p-6 text-sm text-slate-500">Selecione {scope === 'fornecedor' ? 'um fornecedor' : scope === 'obra' ? 'uma obra' : 'um traço'} para montar a carta de controle.</div></Card>
       : cartaQ.isLoading ? <LoadingState />
       : cartaQ.error ? <ErrorState message={(cartaQ.error as Error).message} />
       : !c || c.n === 0 ? <Card><div className="p-6 text-sm text-slate-500">Sem pares suficientes na idade de controle ({c?.idade ?? 28} dias) para este recorte no período.</div></Card>
       : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Subgrupos (pares)" value={c.n} detail={`idade ${c.idade} dias`} />
            <Stat label="Média X̄̄" value={`${c.xbb} MPa`} detail={`LSC ${c.ucl_x} · LIC ${c.lcl_x}`} />
            <Stat label="Amplitude média R̄" value={`${c.rbar} MPa`} detail={`LSC_R ${c.ucl_r}`} />
            <Stat label="Fora de controle" value={c.fora_controle ?? 0} detail={c.fck != null ? `${c.abaixo_fck ?? 0} exemplar(es) < fck ${c.fck}` : undefined} />
          </div>
          <ChartPanel title="Carta X̄ — média do par por exemplar (MPa)" size="half">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dados} margin={{ top: 8, right: 24, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tipStyle} />
                <ReferenceLine y={c.ucl_x} stroke="#dc2626" strokeDasharray="5 4" label={{ value: 'LSC', position: 'right', fontSize: 10, fill: '#dc2626' }} />
                <ReferenceLine y={c.cl_x} stroke="#16a34a" label={{ value: 'LC', position: 'right', fontSize: 10, fill: '#16a34a' }} />
                <ReferenceLine y={c.lcl_x} stroke="#dc2626" strokeDasharray="5 4" label={{ value: 'LIC', position: 'right', fontSize: 10, fill: '#dc2626' }} />
                {c.fck != null ? <ReferenceLine y={c.fck} stroke="#182863" strokeDasharray="2 3" label={{ value: 'fck', position: 'right', fontSize: 10, fill: '#182863' }} /> : null}
                <Line type="monotone" dataKey="x" stroke="#C5117E" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Carta R — amplitude do par (MPa)" size="half">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dados} margin={{ top: 8, right: 24, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tipStyle} />
                <ReferenceLine y={c.ucl_r} stroke="#dc2626" strokeDasharray="5 4" label={{ value: 'LSC_R', position: 'right', fontSize: 10, fill: '#dc2626' }} />
                <ReferenceLine y={c.rbar} stroke="#16a34a" label={{ value: 'R̄', position: 'right', fontSize: 10, fill: '#16a34a' }} />
                <Line type="monotone" dataKey="r" stroke="#182863" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>
          <p className="text-xs text-slate-500">Limites 3σ estimados de R̄ com fatores de Shewhart para subgrupo n=2 (A2={c.a2}, D4={c.d4}). Pontos fora dos limites ou tendências indicam causa especial — investigue moldagem, cura, capeamento ou prensa. Não é o critério de aceitação (fck), é controle de processo.</p>
        </>
      )}
    </div>
  );
}

export function LabDashboardsPage() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const f = useDashboardFilters({ painel: 'exec' });
  const active = (dashboards.some((d) => d.id === f.painel) ? f.painel : 'exec') as DashId;
  const snapshotQ = useQuery({
    queryKey: ['lab-dashboard-snapshot', member?.tenant_id, f.from, f.to, f.clientId, f.workId],
    enabled: !!member,
    queryFn: () => getLabDashboardSnapshot({ from: f.from, to: f.to, clientId: f.clientId || undefined, workId: f.workId || undefined, materialKind: 'concreto' }),
  });
  const qualidadeQ = useQuery({
    queryKey: ['dashboard-qualidade-v2', member?.tenant_id, f.from, f.to, f.clientId, f.workId],
    enabled: !!member && QUALITY_PANELS.has(active),
    queryFn: () => getDashboardQualidadeV2({ from: f.from, to: f.to, clientId: f.clientId || undefined, workId: f.workId || undefined }),
  });
  const businessQ = useQuery({
    queryKey: ['dashboard-business-v2', member?.tenant_id, f.from, f.to, f.clientId, f.workId],
    enabled: !!member && active === 'negocio',
    queryFn: () => getDashboardBusiness({ from: f.from, to: f.to, clientId: f.clientId || undefined, workId: f.workId || undefined }),
  });
  const opsQ = useQuery({
    queryKey: ['dashboard-ops-v2', member?.tenant_id, f.from, f.to, f.clientId, f.workId],
    enabled: !!member && OPS_PANELS.has(active),
    queryFn: () => getDashboardOps({ from: f.from, to: f.to, clientId: f.clientId || undefined, workId: f.workId || undefined }),
  });
  const snapshot = snapshotQ.data ?? emptySnapshot({ from: f.from, to: f.to });
  const qualidade = qualidadeQ.data ?? emptyQualidadeV2;
  const business = businessQ.data;
  const ops = opsQ.data;
  const busca = f.q.toLowerCase().trim();
  const visibles = busca ? dashboards.filter((d) => (d.titulo + d.grupo + d.desc).toLowerCase().includes(busca)) : dashboards;
  const grupos = [...new Set(visibles.map((d) => d.grupo))];
  const current = dashboards.find((d) => d.id === active) ?? dashboards[0];
  const grupoAtivo = visibles.some((d) => d.id === active) ? current.grupo : (grupos[0] ?? current.grupo);
  const doGrupo = visibles.filter((d) => d.grupo === grupoAtivo);
  const carregando = snapshotQ.isLoading || (QUALITY_PANELS.has(active) && qualidadeQ.isLoading) || (active === 'negocio' && businessQ.isLoading) || (OPS_PANELS.has(active) && opsQ.isLoading);
  const erro = (snapshotQ.error ?? (QUALITY_PANELS.has(active) ? qualidadeQ.error : null) ?? (active === 'negocio' ? businessQ.error : null) ?? (OPS_PANELS.has(active) ? opsQ.error : null)) as Error | null;

  async function exportar() {
    const extras: Record<string, Array<Record<string, unknown>>> = {
      qualidade: qualidade.insatisfatorios_obra as never,
      insatisfatorios: qualidade.insatisfatorios_obra as never,
      altas: qualidade.tracos_altos as never,
      variacao: qualidade.heatmap_fck_obra as never,
      resistencia: qualidade.dispersao_tracos as never,
    };
    const opsSeries: Record<string, OpsPoint[]> = current.id !== 'negocio' && OPS_PANELS.has(current.id) && ops ? {
      risco: ops.risco.itens.map((r) => ({ label: r.label, value: r.value, severidade: r.severity })),
      nc: ops.nc.mensal, equipamentos: ops.equipamentos.calibracoes.map((c) => ({ label: c.label, validade: c.validade ?? '', dias: c.dias ?? '' })),
      produtividade: ops.produtividade.mensal, docgate: ops.docgate.vencimentos.map((d) => ({ label: d.titulo, status: d.status, validade: d.data_validade ?? '', dias: d.dias ?? '' })),
      contratos: ops.contratos.balanco.map((c) => ({ label: c.numero ?? 'contrato', cliente: c.cliente ?? '', limite: c.valor_limite, medido: c.valor_medido, faturado: c.valor_faturado, saldo: c.saldo_a_medir, consumo_pct: c.consumo_pct ?? '' })),
      sla: ops.sla.mensal, logistica: ops.logistica.mensal,
    } : {};
    const opsRows = (opsSeries[current.id] ?? []) as Array<Record<string, unknown>>;
    const businessRows = current.id === 'negocio' && business ? [
      ...business.crm_by_stage.map((row) => ({ grupo: 'CRM', indicador: row.label, quantidade: row.value ?? 0, valor: row.amount ?? 0 })),
      ...business.proposals_by_status.map((row) => ({ grupo: 'Propostas', indicador: row.label, quantidade: row.value ?? 0, valor: row.amount ?? 0 })),
      ...business.purchases_by_status.map((row) => ({ grupo: 'Compras', indicador: row.label, quantidade: row.value ?? 0, valor: row.amount ?? 0 })),
    ] : [];
    const rows = [
      ...(snapshot.lists[current.id] ?? []),
      ...rank(snapshot, current.id).map((r) => ({ nome: r.nome, valor: r.valor, detalhe: r.detalhe ?? '', taxa: r.taxa ?? null })),
      ...(extras[current.id] ?? []),
      ...businessRows,
      ...opsRows,
    ];
    await exportExcel(
      { title: 'Dashboard - ' + current.titulo, subtitle: member?.tenant_name, filename: 'dashboard-' + current.id + '.xlsx', fields: [{ label: 'Período', value: `${f.from} a ${f.to}` }] },
      { name: current.titulo, rows: rows.length ? rows : [{ indicador: current.titulo, valor: 'Sem dados no período' }], columns: Object.keys(rows[0] ?? { indicador: '', valor: '' }).map((k) => ({ key: k, header: k, width: 22 })) },
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Gestão do laboratório" description={`${dashboards.length} painéis em tela cheia com filtros por período, cliente e obra — persistidos na URL para compartilhar a análise.`} />
      <DashboardShell
        filterBar={
          <div>
            <DashboardFilterBar
              from={f.from} to={f.to} clientId={f.clientId} workId={f.workId}
              onChange={(patch) => f.set(patch)}
              extra={<>
                <div className="w-44"><Field label="Buscar painel" value={f.q} onChange={(e) => f.set({ q: e.target.value })} placeholder="qualidade, slump..." /></div>
                <div className="pb-0.5"><Button onClick={() => void exportar()} disabled={!current.exportavel}>Exportar Excel</Button></div>
              </>}
            />
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
              {grupos.map((g) => (
                <button key={g} type="button"
                  onClick={() => { const first = visibles.find((d) => d.grupo === g); if (first) f.set({ painel: first.id }); }}
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide transition ${g === grupoAtivo ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  style={g === grupoAtivo ? { background: 'var(--grad-brand)' } : undefined}>
                  {g}
                </button>
              ))}
              <span className="mx-1 hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
              {doGrupo.map((d) => (
                <button key={d.id} type="button" onClick={() => f.set({ painel: d.id })} title={d.desc}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${d.id === active ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  {d.titulo}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <Card><CardHeader kicker={current.grupo} title={current.titulo}>{current.desc}</CardHeader></Card>
        {active === 'carta_controle'
          ? <CartaControlePanel from={f.from} to={f.to} />
          : carregando ? <LoadingState />
          : erro ? <ErrorState message={erro.message} />
          : active === 'negocio' && business ? <BusinessPanel data={business} nav={(to) => navigate(to)} />
          : OPS_PANELS.has(active) && ops ? <OpsPanel id={active} ops={ops} nav={(to) => navigate(to)} />
          : <Panel id={active} snapshot={snapshot} qualidade={qualidade} nav={(to) => navigate(to)} />}
      </DashboardShell>
    </div>
  );
}
