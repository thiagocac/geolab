import { supabase } from '../supabase';
import { env } from '../env';
import type { Estrutura } from './estruturaObra';

type Rec = Record<string, any>;

async function callPortalEstrutura(action: string, payload: Rec): Promise<Rec> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/client-portal-estrutura', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ action, ...payload }),
  });
  const txt = await resp.text();
  const p = (txt ? JSON.parse(txt) : {}) as Rec;
  if (!resp.ok || p.ok === false) throw new Error(String(p.error ?? 'Erro na estrutura da obra'));
  return p;
}

function mapEstrutura(r: Rec): Estrutura {
  return { id: String(r.id), work_id: String(r.work_id), nome: String(r.nome ?? ''), ordem: Number(r.ordem ?? 0), pecas: Array.isArray(r.pecas) ? r.pecas.map((x: Rec) => ({ id: String(x.id), nome: String(x.nome ?? '') })).filter((x: { nome: string }) => x.nome) : [] };
}

export async function listPortalEstruturas(workId: string): Promise<Estrutura[]> {
  if (!workId) return [];
  const p = await callPortalEstrutura('list', { work_id: workId });
  return ((p.estruturas ?? []) as Rec[]).map(mapEstrutura);
}
export async function savePortalEstrutura(workId: string, est: { id?: string; nome: string; pecas: { id: string; nome: string }[] }): Promise<void> { await callPortalEstrutura('save', { work_id: workId, estrutura: est }); }
export async function duplicatePortalEstrutura(id: string): Promise<void> { await callPortalEstrutura('duplicate', { id }); }
export async function deletePortalEstrutura(id: string): Promise<void> { await callPortalEstrutura('delete', { id }); }
