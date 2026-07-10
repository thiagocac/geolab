import { supabase } from '../supabase';

type Json = Record<string, unknown>;
const rpcClient = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const text=(v:unknown)=>String(v??''); const nullable=(v:unknown):string|null=>v==null||v===''?null:String(v); const num=(v:unknown)=>Number(v)||0;
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{const {data,error}=await rpcClient.rpc(name,args);if(error)throw new Error(error.message);return data as T;}
export type PortalFinanceSnapshot={enabled:boolean;from:string;to:string;works:Array<{id:string;nome:string;codigo:string|null}>;measurements:Json[];invoices:Json[];receivables:Json[];kpis:{measured:number;invoiced:number;open:number;overdue:number}};
export async function getPortalFinancialSnapshot(from?:string,to?:string,workId?:string):Promise<PortalFinanceSnapshot>{const raw=await rpc<Json>('portal_financial_snapshot',{p_from:from||null,p_to:to||null,p_work_id:workId||null});const k=(raw.kpis??{})as Json;return{enabled:raw.enabled===true,from:text(raw.from),to:text(raw.to),works:((raw.works??[])as Json[]).map(r=>({id:text(r.id),nome:text(r.nome),codigo:nullable(r.codigo)})),measurements:(raw.measurements??[])as Json[],invoices:(raw.invoices??[])as Json[],receivables:(raw.receivables??[])as Json[],kpis:{measured:num(k.measured),invoiced:num(k.invoiced),open:num(k.open),overdue:num(k.overdue)}};}
export async function setPortalFinancePermission(memberId:string,enabled:boolean):Promise<Json>{return rpc('set_portal_finance_permission',{p_member_id:memberId,p_enabled:enabled});}
const dbClient = supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> } } } };
export async function getPortalPermissoes(memberId: string): Promise<Record<string, unknown>> {
  const { data, error } = await dbClient.from('members').select('portal_permissoes').eq('id', memberId).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as Json | null)?.portal_permissoes ?? {}) as Record<string, unknown>;
}
