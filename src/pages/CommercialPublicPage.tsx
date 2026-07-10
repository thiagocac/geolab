import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextArea } from '../components/ui/Field';
import { LoadingState, ErrorState } from '../components/ui/State';
import { decideCommercialPublic, readCommercialPublic, type JsonObject } from '../lib/api/productEvolution';

const money = (value: unknown) => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const value = (row: JsonObject, key: string) => row[key] == null ? '' : String(row[key]);

export function CommercialPublicPage({ kind }: { kind: 'proposal' | 'measurement' }) {
  const { token = '' } = useParams();
  const [comment, setComment] = useState('');
  const q = useQuery({ queryKey: ['commercial-public', kind, token], queryFn: () => readCommercialPublic(kind, token), enabled: !!token, retry: false });
  const mutation = useMutation({ mutationFn: (decision: string) => decideCommercialPublic(kind, token, decision, comment), onSuccess: () => void q.refetch() });
  if (q.isLoading) return <main className="mx-auto max-w-4xl p-6"><LoadingState /></main>;
  if (q.isError) return <main className="mx-auto max-w-4xl p-6"><ErrorState message={(q.error as Error).message} /></main>;
  const data = q.data ?? {};
  if (data.ok === false) return <main className="mx-auto max-w-xl p-6"><ErrorState message={String(data.error ?? 'Link inválido ou expirado.')} /></main>;
  const proposal = kind === 'proposal' ? data : null;
  const measurement = kind === 'measurement' ? data : null;
  const items = Array.isArray(data.itens) ? data.itens as JsonObject[] : Array.isArray(data.items) ? data.items as JsonObject[] : [];
  const title = kind === 'proposal' ? `Proposta ${value(data, 'numero')}` : `Medição ${value(data, 'numero') || value(data, 'competencia')}`;
  const client = (data.cliente && typeof data.cliente === 'object' ? data.cliente : {}) as JsonObject;
  const lab = (data.laboratorio && typeof data.laboratorio === 'object' ? data.laboratorio : {}) as JsonObject;
  const clientLabel = typeof data.cliente === 'string' ? data.cliente : value(client, 'razao_social') || value(client, 'nome_fantasia') || value(data, 'razao_social');
  const labLabel = typeof data.laboratorio === 'string' ? data.laboratorio : value(lab, 'nome') || value(data, 'lab_name');
  const currentStatus = value(data, 'status');
  const decided = ['aceita', 'recusada', 'aprovada', 'contestada'].includes(currentStatus) || Boolean(data.decisao_cliente);
  return <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950"><div className="mx-auto max-w-4xl space-y-5">
    <header className="rounded-2xl bg-gradient-to-r from-[#182863] via-[#3E2D71] to-[#C5117E] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.18em]">Concresoft · documento seguro</p><h1 className="mt-2 text-2xl font-black">{title}</h1><p className="mt-2 text-sm text-white/80">{labLabel} · {clientLabel}</p></header>
    <Card className="p-5"><div className="grid gap-4 md:grid-cols-3"><div><p className="kicker">Status</p><b>{currentStatus || value(data, 'decisao_cliente') || 'enviada'}</b></div>{kind === 'proposal' ? <><div><p className="kicker">Validade</p><b>{value(data, 'validade') || '—'}</b></div><div><p className="kicker">Total</p><b>{money(data.valor_total)}</b></div></> : <><div><p className="kicker">Período</p><b>{value(data, 'periodo_inicio')} a {value(data, 'periodo_fim')}</b></div><div><p className="kicker">Total</p><b>{money(data.valor_total)}</b></div></>}</div>{proposal && value(proposal, 'titulo') ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{value(proposal, 'titulo')}</p> : null}{measurement && value(measurement, 'observacoes') ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{value(measurement, 'observacoes')}</p> : null}</Card>
    <Card className="p-0"><div className="table-scroll"><table className="table"><thead><tr><th>Item</th><th>Unidade</th><th className="text-right">Quantidade</th><th className="text-right">Preço</th><th className="text-right">Total</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${value(item, 'item_code')}-${index}`}><td>{value(item, 'descricao') || value(item, 'description')}</td><td>{value(item, 'unidade') || value(item, 'unit')}</td><td className="text-right">{value(item, 'quantidade') || value(item, 'quantity')}</td><td className="text-right">{money(item.preco_unitario ?? item.unitPrice)}</td><td className="text-right font-bold">{money(item.valor_total ?? item.subtotal)}</td></tr>)}</tbody></table></div></Card>
    <Card className="p-5">{decided ? <div className="text-center"><p className="kicker">Decisão registrada</p><p className="mt-2 text-xl font-black">{currentStatus || value(data, 'decisao_cliente')}</p><p className="mt-2 text-sm text-slate-500">Esta decisão está registrada na trilha de auditoria do laboratório.</p></div> : <div className="space-y-4"><TextArea label="Comentário (opcional)" value={comment} onChange={(event) => setComment(event.target.value)} /><div className="flex flex-wrap justify-end gap-3">{kind === 'proposal' ? <><Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate('recusada')}>Recusar</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate('aceita')}>Aceitar proposta</Button></> : <><Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate('contestada')}>Contestar</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate('aceita')}>Aprovar medição</Button></>}</div>{mutation.isError ? <ErrorState message={(mutation.error as Error).message} /> : null}</div>}</Card>
    <p className="text-center text-xs text-slate-500">Link individual, com expiração e decisão imutável após o registro.</p>
  </div></main>;
}
