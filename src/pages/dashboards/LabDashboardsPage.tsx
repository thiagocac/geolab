import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, AreaChart, Area, PieChart, Pie, Legend, ScatterChart, Scatter, ZAxis, ComposedChart, ReferenceLine } from 'recharts';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { exportExcel } from '../../lib/export/xlsx';
import { getLabDashboardSnapshot, emptySnapshot, cartaControleOpcoes, getCartaControle, type LabDashboardSnapshot, type SeriePoint, type RankingRow, type CartaScope } from '../../lib/api/dashboards';

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 12 } as const;
const palette = ['#182863', '#C5117E', '#3E2D71', '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#64748b'];

type DashId =
  | 'exec' | 'qualidade' | 'rompimentos' | 'resistencia' | 'insatisfatorios' | 'altas' | 'variacao' | 'carta_controle' | 'slump' | 'fornecedores' | 'obras'
  | 'logistica' | 'sla' | 'pendencias' | 'nc' | 'docgate' | 'equipamentos' | 'produtividade' | 'financeiro' | 'contratos' | 'risco';

type Dash = { id: DashId; titulo: string; grupo: string; desc: string; exportavel?: boolean };
const dashboards: Dash[] = [
  { id: 'exec', titulo: 'Executivo do laboratório', grupo: 'Direção', desc: 'Volume, conformidade, laudos, receita e riscos operacionais.', exportavel: true },
  { id: 'qualidade', titulo: 'Qualidade e aceitação', grupo: 'Técnico', desc: 'Conformidade na idade de controle, fck,est e tendência por obra.', exportavel: true },
  { id: 'rompimentos', titulo: 'Agenda de rompimentos', grupo: 'Operação', desc: 'Atrasados, hoje, próximos 7 dias e backlog por idade.', exportavel: true },
  { id: 'resistencia', titulo: 'Curva de resistência', grupo: 'Técnico', desc: 'Evolução 7d/28d e comparação com fck por traço/obra.', exportavel: true },
  { id: 'insatisfatorios', titulo: 'Resultados insatisfatórios', grupo: 'Qualidade', desc: 'CPs/exemplares abaixo do fck apenas na idade de controle.', exportavel: true },
  { id: 'altas', titulo: 'Altas resistências', grupo: 'Qualidade', desc: 'Resultados muito acima do fck para identificar excesso de consumo ou traço conservador.', exportavel: true },
  { id: 'variacao', titulo: 'Variação e dispersão', grupo: 'Qualidade', desc: 'Amplitude, desvio, coeficiente de variação e estabilidade por traço.', exportavel: true },
  { id: 'carta_controle', titulo: 'Carta de controle (X̄-R)', grupo: 'Qualidade', desc: 'Média e amplitude do par na idade de controle, com limites 3σ (Shewhart n=2) por traço, obra ou fornecedor.' },
  { id: 'slump', titulo: 'Slump e recebimento', grupo: 'Campo', desc: 'Abatimento medido, temperatura do concreto e rejeições.', exportavel: true },
  { id: 'fornecedores', titulo: 'Fornecedores / concreteiras', grupo: 'Fornecedor', desc: 'Ranking por volume, conformidade, atraso e ocorrência.', exportavel: true },
  { id: 'obras', titulo: 'Scorecard por obra', grupo: 'Cliente', desc: 'Ranking de obras com volume, pendências, conformidade e receita.', exportavel: true },
  { id: 'logistica', titulo: 'Logística do caminhão', grupo: 'Campo', desc: 'Saída, chegada, descarga, permanência e vencimento de concreto.', exportavel: true },
  { id: 'sla', titulo: 'SLA do laboratório', grupo: 'Operação', desc: 'Prazo de recebimento, rompimento, lançamento, emissão e aprovação de laudo.', exportavel: true },
  { id: 'pendencias', titulo: 'Pendências e lançamentos', grupo: 'Operação', desc: 'CPs sem resultado, laudos sem emissão, documentos pendentes e lotes incompletos.', exportavel: true },
  { id: 'nc', titulo: 'Não conformidades', grupo: 'Qualidade', desc: 'NC por tipo, severidade, obra, status e tempo de resolução.', exportavel: true },
  { id: 'docgate', titulo: 'Documentos e gate', grupo: 'Governança', desc: 'Calibração, certificações, ART, dosagem e bloqueios de laudo.', exportavel: true },
  { id: 'equipamentos', titulo: 'Equipamentos e calibração', grupo: 'Governança', desc: 'Uso por prensa, validade de calibração e risco de parada.', exportavel: true },
  { id: 'produtividade', titulo: 'Produtividade da equipe', grupo: 'Operação', desc: 'Coletas, rompimentos, laudos por colaborador e taxa de retrabalho.', exportavel: true },
  { id: 'financeiro', titulo: 'Financeiro do laboratório', grupo: 'Financeiro', desc: 'Medição, faturamento, aberto, vencido e custo da não qualidade.', exportavel: true },
  { id: 'contratos', titulo: 'Contratos e medição', grupo: 'Financeiro', desc: 'Cobertura contratual, preços por ensaio, medições e reajustes.', exportavel: true },
  { id: 'risco', titulo: 'Risco integrado', grupo: 'Direção', desc: 'Score de risco por obra/cliente combinando técnica, operação, financeiro e documentação.', exportavel: true },
];

function startOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function today() { return new Date().toISOString().slice(0, 10); }
function n(snapshot: LabDashboardSnapshot, key: string) { return Number(snapshot.kpis[key] ?? 0); }
function money(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function pct(v: number) { return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`; }
function series(s: LabDashboardSnapshot, key: string): SeriePoint[] { return s.series[key] ?? []; }
function rank(s: LabDashboardSnapshot, key: string): RankingRow[] { return s.rankings[key] ?? []; }

function ChartBox({ title, children }: { title: string; children: ReactNode }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="kicker mb-3">{title}</p><div style={{ height: 280 }}>{children}</div></div>; }
function Bars({ data, dataKey = 'valor' }: { data: Array<Record<string, unknown>>; dataKey?: string }) { return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} /><YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tipStyle} /><Bar dataKey={dataKey} radius={[7, 7, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Bar></BarChart></ResponsiveContainer>; }
function Lines({ data, keys }: { data: Array<Record<string, unknown>>; keys: string[] }) { return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} /><YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tipStyle} />{keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2.5} dot={false} />)}</LineChart></ResponsiveContainer>; }
function Donut({ data }: { data: Array<Record<string, unknown>> }) { return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="valor" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie><Tooltip contentStyle={tipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>; }
function Ranking({ data }: { data: RankingRow[] }) { return <div className="grid gap-2">{data.slice(0, 10).map((r, i) => <div key={r.id ?? r.nome} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-800 dark:text-slate-100">{i + 1}. {r.nome}</span><span className="font-black tabular-nums text-slate-950 dark:text-slate-50">{r.taxa != null ? pct(r.taxa) : r.valor.toLocaleString('pt-BR')}</span></div>{r.detalhe ? <p className="mt-1 text-xs text-slate-500">{r.detalhe}</p> : null}</div>)}</div>; }

function Panel({ id, snapshot }: { id: DashId; snapshot: LabDashboardSnapshot }) {
  const qualidade = series(snapshot, 'qualidade_mensal');
  const volume = series(snapshot, 'volume_mensal');
  const prazos = series(snapshot, 'sla_mensal');
  if (id === 'exec') return <><div className="grid gap-3 md:grid-cols-4"><Stat label="Volume recebido" value={n(snapshot, 'volume_m3').toLocaleString('pt-BR')} detail="m³ no período" /><Stat label="Ensaios" value={n(snapshot, 'ensaios').toLocaleString('pt-BR')} /><Stat label="Conformidade" value={pct(n(snapshot, 'taxa_conformidade'))} /><Stat label="Receita medida" value={money(n(snapshot, 'receita_medida'))} /></div><div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Volume e ensaios por mês"><Lines data={volume as never} keys={['volume', 'ensaios']} /></ChartBox><ChartBox title="Status de laudos"><Donut data={series(snapshot, 'laudos_status') as never} /></ChartBox></div></>;
  if (id === 'qualidade') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Conformidade mensal"><Lines data={qualidade as never} keys={['conforme', 'nao_conforme']} /></ChartBox><Card><CardHeader title="Piores desvios por obra" kicker="Qualidade" /><div className="p-4"><Ranking data={rank(snapshot, 'obras_risco_qualidade')} /></div></Card></div>;
  if (id === 'rompimentos') return <><div className="grid gap-3 md:grid-cols-4"><Stat label="Atrasados" value={n(snapshot, 'rompimentos_atrasados')} /><Stat label="Hoje" value={n(snapshot, 'rompimentos_hoje')} /><Stat label="7 dias" value={n(snapshot, 'rompimentos_7d')} /><Stat label="Sem resultado" value={n(snapshot, 'cp_sem_resultado')} /></div><ChartBox title="Agenda por idade"><Bars data={series(snapshot, 'agenda_idades') as never} /></ChartBox></>;
  if (id === 'resistencia') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Curva 7d / 28d / FCK"><Lines data={series(snapshot, 'curva_resistencia') as never} keys={['sete_dias', 'vinte_oito_dias', 'meta']} /></ChartBox><ChartBox title="Dispersão por traço"><ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid stroke="var(--line)" /><XAxis dataKey="volume" name="Volume" tick={{ fontSize: 11 }} /><YAxis dataKey="valor" name="MPa" tick={{ fontSize: 11 }} /><ZAxis dataKey="count" range={[40, 420]} /><Tooltip contentStyle={tipStyle} /><Scatter data={rank(snapshot, 'tracos_dispersao') as never} fill="#C5117E" /></ScatterChart></ResponsiveContainer></ChartBox></div>;
  if (id === 'insatisfatorios') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Insatisfatórios por mês"><Bars data={series(snapshot, 'insatisfatorios_mensal') as never} /></ChartBox><Card><CardHeader title="Exemplares críticos" kicker="Ação técnica" /><div className="p-4"><Ranking data={rank(snapshot, 'insatisfatorios_obra')} /></div></Card></div>;
  if (id === 'altas') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Acima de 140% do FCK"><Bars data={series(snapshot, 'altas_resistencias') as never} /></ChartBox><Card><CardHeader title="Traços com possível excesso" kicker="Otimização" /><div className="p-4"><Ranking data={rank(snapshot, 'tracos_altos')} /></div></Card></div>;
  if (id === 'variacao') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Coeficiente de variação"><Lines data={series(snapshot, 'variacao_mensal') as never} keys={['valor', 'meta']} /></ChartBox><ChartBox title="Heatmap FCK × obra"><Bars data={(snapshot.heatmaps.fck_obra ?? []).map((h) => ({ label: `${h.obra} ${h.faixa}`, valor: h.valor })) as never} /></ChartBox></div>;
  if (id === 'slump') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Slump médio mensal"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series(snapshot, 'slump_mensal') as never}><CartesianGrid stroke="var(--line)" /><XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tipStyle} /><Bar dataKey="valor" fill="#182863" /><Line dataKey="meta" stroke="#C5117E" strokeWidth={2} /></ComposedChart></ResponsiveContainer></ChartBox><Card><CardHeader title="Ocorrências de recebimento" kicker="Campo" /><div className="p-4"><Ranking data={rank(snapshot, 'recebimento_ocorrencias')} /></div></Card></div>;
  if (id === 'fornecedores') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Volume por concreteira"><Bars data={rank(snapshot, 'fornecedores_volume').map((r) => ({ label: r.nome, valor: r.valor })) as never} /></ChartBox><Card><CardHeader title="Ranking por conformidade" kicker="Fornecedor" /><div className="p-4"><Ranking data={rank(snapshot, 'fornecedores_conformidade')} /></div></Card></div>;
  if (id === 'obras') return <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Scorecard por obra" kicker="Cliente" /><div className="p-4"><Ranking data={rank(snapshot, 'obras_scorecard')} /></div></Card><ChartBox title="Uso por obra"><Bars data={rank(snapshot, 'obras_volume').map((r) => ({ label: r.nome, valor: r.valor })) as never} /></ChartBox></div>;
  if (id === 'logistica') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Permanência média em obra"><Bars data={series(snapshot, 'permanencia_mensal') as never} /></ChartBox><ChartBox title="Tempos por etapa"><Lines data={series(snapshot, 'tempos_logistica') as never} keys={['transporte', 'descarga', 'moldagem']} /></ChartBox></div>;
  if (id === 'sla') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="SLA técnico mensal"><Lines data={prazos as never} keys={['rompimento', 'laudo', 'aprovacao']} /></ChartBox><Card><CardHeader title="Gargalos atuais" kicker="SLA" /><div className="p-4"><Ranking data={rank(snapshot, 'sla_gargalos')} /></div></Card></div>;
  if (id === 'pendencias') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Pendências por tipo"><Bars data={series(snapshot, 'pendencias_tipo') as never} /></ChartBox><Card><CardHeader title="Fila crítica" kicker="Operação" /><div className="p-4"><Ranking data={rank(snapshot, 'pendencias_criticas')} /></div></Card></div>;
  if (id === 'nc') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="NC por severidade"><Donut data={series(snapshot, 'nc_severidade') as never} /></ChartBox><ChartBox title="Tempo de resolução"><Bars data={series(snapshot, 'nc_resolucao') as never} /></ChartBox></div>;
  if (id === 'docgate') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Conformidade documental"><Donut data={series(snapshot, 'docgate_status') as never} /></ChartBox><Card><CardHeader title="Bloqueios de laudo" kicker="Gate" /><div className="p-4"><Ranking data={rank(snapshot, 'docgate_bloqueios')} /></div></Card></div>;
  if (id === 'equipamentos') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Uso por prensa"><Bars data={rank(snapshot, 'equipamentos_uso').map((r) => ({ label: r.nome, valor: r.valor })) as never} /></ChartBox><Card><CardHeader title="Calibração a vencer" kicker="Rastreabilidade" /><div className="p-4"><Ranking data={rank(snapshot, 'equipamentos_validade')} /></div></Card></div>;
  if (id === 'produtividade') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Produção por equipe"><Bars data={rank(snapshot, 'colaboradores_produtividade').map((r) => ({ label: r.nome, valor: r.valor })) as never} /></ChartBox><ChartBox title="Laudos por mês"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series(snapshot, 'laudos_mensal') as never}><CartesianGrid stroke="var(--line)" /><XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tipStyle} /><Area dataKey="valor" fill="#182863" stroke="#182863" fillOpacity={0.18} /></AreaChart></ResponsiveContainer></ChartBox></div>;
  if (id === 'financeiro') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Medição × faturamento × recebimento"><Lines data={snapshot.finance as never} keys={['previsto', 'realizado', 'aberto']} /></ChartBox><ChartBox title="Custo da não qualidade"><Bars data={series(snapshot, 'custo_nao_qualidade') as never} /></ChartBox></div>;
  if (id === 'contratos') return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Cobertura contratual"><Donut data={series(snapshot, 'contratos_status') as never} /></ChartBox><Card><CardHeader title="Contratos com atenção" kicker="Financeiro" /><div className="p-4"><Ranking data={rank(snapshot, 'contratos_risco')} /></div></Card></div>;
  return <div className="grid gap-4 lg:grid-cols-2"><ChartBox title="Score de risco integrado"><Bars data={rank(snapshot, 'risco_integrado').map((r) => ({ label: r.nome, valor: r.valor })) as never} /></ChartBox><Card><CardHeader title="Alertas priorizados" kicker="Risco" /><div className="grid gap-2 p-4">{snapshot.alerts.slice(0, 10).map((a, i) => <div key={a.id ?? i} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><strong>{a.titulo}</strong><p className="text-sm text-slate-500">{a.detalhe}</p></div>)}</div></Card></div>;
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
          <ChartBox title="Carta X̄ — média do par por exemplar (MPa)">
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
          </ChartBox>
          <ChartBox title="Carta R — amplitude do par (MPa)">
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
          </ChartBox>
          <p className="text-xs text-slate-500">Limites 3σ estimados de R̄ com fatores de Shewhart para subgrupo n=2 (A2={c.a2}, D4={c.d4}). Pontos fora dos limites ou tendências indicam causa especial — investigue moldagem, cura, capeamento ou prensa. Não é o critério de aceitação (fck), é controle de processo.</p>
        </>
      )}
    </div>
  );
}

export function LabDashboardsPage() {
  const { member } = useAuth();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [active, setActive] = useState<DashId>('exec');
  const [search, setSearch] = useState('');
  const filters = { from, to, materialKind: 'concreto' };
  const q = useQuery({ queryKey: ['lab-dashboard-snapshot', member?.tenant_id, from, to], enabled: !!member, queryFn: () => getLabDashboardSnapshot(filters) });
  const snapshot = q.data ?? emptySnapshot(filters);
  const visibles = dashboards.filter((d) => (d.titulo + d.grupo + d.desc).toLowerCase().includes(search.toLowerCase().trim()));
  const current = dashboards.find((d) => d.id === active) ?? dashboards[0];
  async function exportar() {
    const rows = [...(snapshot.lists[current.id] ?? []), ...rank(snapshot, current.id).map((r) => ({ nome: r.nome, valor: r.valor, detalhe: r.detalhe ?? '', taxa: r.taxa ?? null }))];
    await exportExcel({ title: 'Dashboard - ' + current.titulo, subtitle: member?.tenant_name, filename: 'dashboard-' + current.id + '.xlsx', fields: [{ label: 'Período', value: `${from} a ${to}` }] }, { name: current.titulo, rows: rows.length ? rows : [{ indicador: current.titulo, valor: 'Sem dados no período' }], columns: Object.keys(rows[0] ?? { indicador: '', valor: '' }).map((k) => ({ key: k, header: k, width: 22 })) });
  }
  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Gestão do laboratório" description="20 painéis interativos para operação, qualidade, finanças, contratos, documentação e risco do laboratório de materiais." />
      <Card>
        <div className="grid gap-3 p-5 md:grid-cols-[160px_160px_1fr_auto]">
          <Field label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Field label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Field label="Buscar painel" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="qualidade, financeiro, slump..." />
          <div className="flex items-end"><Button onClick={() => void exportar()} disabled={!current.exportavel}>Exportar Excel</Button></div>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-4"><Stat label="Conformidade" value={pct(n(snapshot, 'taxa_conformidade'))} /><Stat label="Volume" value={n(snapshot, 'volume_m3').toLocaleString('pt-BR')} detail="m³" /><Stat label="Laudos" value={n(snapshot, 'laudos_emitidos')} /><Stat label="Receita medida" value={money(n(snapshot, 'receita_medida'))} /></div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-3">
          <div className="grid gap-2">{visibles.map((d) => <button key={d.id} type="button" onClick={() => setActive(d.id)} className={'rounded-2xl p-3 text-left transition ' + (active === d.id ? 'text-white shadow-md' : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800')} style={active === d.id ? { background: 'var(--grad-brand)' } : undefined}><span className="block text-xs font-black uppercase opacity-80">{d.grupo}</span><span className="block font-black">{d.titulo}</span><span className="mt-1 block text-xs opacity-80">{d.desc}</span></button>)}</div>
        </Card>
        <div className="space-y-4">
          <Card><CardHeader kicker={current.grupo} title={current.titulo}>{current.desc}</CardHeader></Card>
          {active === 'carta_controle' ? <CartaControlePanel from={from} to={to} /> : q.isLoading ? <LoadingState /> : q.error ? <ErrorState message={(q.error as Error).message} /> : <Panel id={active} snapshot={snapshot} />}
        </div>
      </div>
    </div>
  );
}
