import { supabase } from '../supabase';
import { trackDomainEvent } from '../telemetry';
import { env } from '../env';

// Coleta de fôrmas (Fase 1) — worklist derivada da concretagem (mig 142) + roteiro do dia (mig 143/144).
const db = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => any;
};

export type WorklistConc = { concretagem_id: string; codigo: string | null; data: string | null; dias: number; previsto: number; coletado: number; saldo: number };
export type WorklistObra = { work_id: string; obra: string; cliente: string | null; endereco: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; contato: string | null; telefone: string | null; total: number; concretagens: WorklistConc[] };

// p_ate tem default current_date no SQL; passar null zeraria a lista -> só enviar args definidos.
export async function coletaWorklist(dias?: number | null, ate?: string | null): Promise<WorklistObra[]> {
  const args: Record<string, unknown> = {};
  if (dias != null && dias > 0) args.p_dias = dias;
  if (ate) args.p_ate = ate;
  const { data, error } = await db.rpc('coleta_worklist', args);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as WorklistObra[];
}

export type NovoItem = { work_id: string; ordem: number; qtd_prevista: number; detalhe: WorklistObra };
export async function criarRoteiro(p: { data?: string | null; motorista_id?: string | null; observacao?: string | null; itens: NovoItem[] }): Promise<string> {
  const { data, error } = await db.rpc('criar_roteiro_coleta', { p_payload: { data: p.data ?? null, motorista_id: p.motorista_id ?? null, observacao: p.observacao ?? null, itens: p.itens } });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { ok?: boolean; id?: string; error?: string };
  if (r.ok === false) throw new Error(r.error || 'Falha ao criar roteiro');
  trackDomainEvent('coleta.roteiro_criado', { paradas: p.itens.length });
  return String(r.id);
}

export type RoteiroRow = { id: string; data: string; status: string; motorista: string | null; observacao: string | null; n_paradas: number; total: number };
export async function listRoteiros(): Promise<RoteiroRow[]> {
  const { data, error } = await db.from('coleta_roteiros')
    .select('id, data, status, observacao, colaboradores(nome), coleta_roteiro_itens(qtd_prevista, deleted_at)')
    .is('deleted_at', null).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => {
    const its = (Array.isArray(r.coleta_roteiro_itens) ? r.coleta_roteiro_itens : []).filter((x: any) => !x.deleted_at);
    return { id: String(r.id), data: String(r.data ?? '').slice(0, 10), status: String(r.status ?? 'aberto'), motorista: r.colaboradores?.nome ?? null, observacao: r.observacao ?? null, n_paradas: its.length, total: its.reduce((s: number, x: any) => s + (Number(x.qtd_prevista) || 0), 0) };
  });
}

export type RoteiroItem = { id: string; ordem: number; work_id: string; qtd_prevista: number; qtd_coletada: number; status: string; observacao: string | null; detalhe: WorklistObra };
export type RoteiroDetalhe = { id: string; data: string; status: string; motorista_id: string | null; motorista: string | null; observacao: string | null; itens: RoteiroItem[] };
export async function getRoteiro(id: string): Promise<RoteiroDetalhe> {
  const { data, error } = await db.from('coleta_roteiros').select('id, data, status, motorista_id, observacao, colaboradores(nome)').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Roteiro não encontrado');
  const { data: its, error: e2 } = await db.from('coleta_roteiro_itens').select('id, ordem, work_id, qtd_prevista, qtd_coletada, status, observacao, detalhe').eq('roteiro_id', id).is('deleted_at', null).order('ordem');
  if (e2) throw new Error(e2.message);
  return {
    id: String(data.id), data: String(data.data ?? '').slice(0, 10), status: String(data.status ?? 'aberto'),
    motorista_id: data.motorista_id ?? null, motorista: (data.colaboradores as any)?.nome ?? null, observacao: data.observacao ?? null,
    itens: ((its ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), ordem: Number(r.ordem) || 0, work_id: String(r.work_id), qtd_prevista: Number(r.qtd_prevista) || 0, qtd_coletada: Number(r.qtd_coletada) || 0, status: String(r.status ?? 'pendente'), observacao: r.observacao ?? null, detalhe: (r.detalhe ?? {}) as WorklistObra })),
  };
}

export async function baixarItem(itemId: string, qtd: number, obs?: string | null): Promise<void> {
  const { data, error } = await db.rpc('baixar_item_coleta', { p_item_id: itemId, p_qtd: Math.max(0, Math.round(qtd || 0)), p_obs: obs ?? null });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { ok?: boolean; error?: string };
  if (r.ok === false) throw new Error(r.error || 'Falha na baixa');
}
export async function concluirRoteiro(id: string): Promise<void> { const { error } = await db.rpc('concluir_roteiro', { p_id: id }); if (error) throw new Error(error.message); }
export async function cancelarRoteiro(id: string): Promise<void> { const { error } = await db.rpc('cancelar_roteiro', { p_id: id }); if (error) throw new Error(error.message); }

export async function roteiroPdfUrl(id: string): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-coleta-formas-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token }, body: JSON.stringify({ roteiro_id: id }) });
  if (!resp.ok) { const t = await resp.text(); throw new Error('Falha ao gerar relatório: ' + t.slice(0, 160)); }
  return URL.createObjectURL(await resp.blob());
}

// Rota no Google Maps (paradas na ordem; destino = última; até 9 waypoints por link).
export function mapsUrlDeParadas(paradas: { endereco?: string | null; cidade?: string | null; uf?: string | null }[]): string {
  const addrs = paradas.map((p) => [p.endereco, p.cidade, p.uf].filter(Boolean).join(', ')).filter((x) => x);
  if (!addrs.length) return '';
  const dest = encodeURIComponent(addrs[addrs.length - 1]);
  const way = addrs.slice(0, -1).slice(0, 9).map((a) => encodeURIComponent(a)).join('|');
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + dest + (way ? '&waypoints=' + way : '');
}

// ---------------- Fase 2: geocodificação + otimização + ponto de partida ----------------
export type Origem = { endereco: string | null; lat: number | null; lng: number | null };
export async function getOrigem(): Promise<Origem> {
  const { data, error } = await db.from('config_lab').select('endereco_origem, origem_lat, origem_lng').maybeSingle();
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return { endereco: (r.endereco_origem as string) ?? null, lat: r.origem_lat == null ? null : Number(r.origem_lat), lng: r.origem_lng == null ? null : Number(r.origem_lng) };
}
export async function setColetaOrigem(endereco: string): Promise<void> {
  const { error } = await db.rpc('set_coleta_origem', { p_endereco: endereco });
  if (error) throw new Error(error.message);
}
export async function worksCoords(ids: string[]): Promise<Record<string, { lat: number; lng: number }>> {
  if (!ids.length) return {};
  const { data, error } = await db.from('client_works').select('id, lat, lng').in('id', ids);
  if (error) throw new Error(error.message);
  const out: Record<string, { lat: number; lng: number }> = {};
  for (const r of (data ?? []) as Record<string, any>[]) if (r.lat != null && r.lng != null) out[String(r.id)] = { lat: Number(r.lat), lng: Number(r.lng) };
  return out;
}
export type GeocodeResp = { ok?: boolean; geocoded: { work_id: string; lat: number; lng: number }[]; origem: { lat: number; lng: number } | null; erros: string[] };
export async function geocodificar(workIds: string[], incluirOrigem: boolean): Promise<GeocodeResp> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/geocode-obras', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token }, body: JSON.stringify({ work_ids: workIds, origem: incluirOrigem }) });
  if (!resp.ok) { const t = await resp.text(); throw new Error('Falha na geocodificação: ' + t.slice(0, 160)); }
  return await resp.json() as GeocodeResp;
}
export async function reordenarRoteiro(id: string, ordens: { id: string; ordem: number }[]): Promise<void> {
  const { error } = await db.rpc('reordenar_roteiro', { p_id: id, p_ordens: ordens });
  if (error) throw new Error(error.message);
}

export type Ponto = { id: string; lat: number; lng: number };
function hav(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
// Vizinho-mais-próximo a partir da origem + 2-opt. Retorna os ids na ordem otimizada.
export function otimizarSequencia(origem: { lat: number; lng: number } | null, pts: Ponto[]): string[] {
  if (pts.length <= 2) return pts.map((p) => p.id);
  const start = origem ?? pts[0];
  const rest = pts.slice();
  const ordem: Ponto[] = [];
  // FIX v175 (auditoria): cur era inferido como uniao {lat,lng}|Ponto e ordem.push(cur) nao compilava
  // (TS2345; quebrava o tsc do gate/Netlify). Runtime identico: o push sempre recebe um Ponto de rest.
  let cur: { lat: number; lng: number } = start;
  while (rest.length) { let bi = 0, bd = Infinity; for (let i = 0; i < rest.length; i++) { const d = hav(cur, rest[i]); if (d < bd) { bd = d; bi = i; } } const prox = rest[bi]; ordem.push(prox); rest.splice(bi, 1); cur = prox; }
  const d0 = (p: Ponto) => (origem ? hav(origem, p) : 0);
  let improved = true, guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 0; i < ordem.length - 1; i++) for (let k = i + 1; k < ordem.length; k++) {
      const A = i === 0 ? null : ordem[i - 1]; const B = ordem[i]; const C = ordem[k]; const D = k + 1 < ordem.length ? ordem[k + 1] : null;
      const before = (A ? hav(A, B) : d0(B)) + (D ? hav(C, D) : 0);
      const after = (A ? hav(A, C) : d0(C)) + (D ? hav(B, D) : 0);
      if (after + 1e-9 < before) { let l = i, r = k; while (l < r) { const t = ordem[l]; ordem[l] = ordem[r]; ordem[r] = t; l++; r--; } improved = true; }
    }
  }
  return ordem.map((p) => p.id);
}
