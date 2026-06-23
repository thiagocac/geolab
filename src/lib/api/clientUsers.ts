import { supabase } from '../supabase';
import { env } from '../env';

const db = supabase as unknown as { from: (t: string) => any };
type Rec = Record<string, unknown>;

export type ClienteOption = { id: string; nome: string };
export type ObraOption = { id: string; nome: string; client_id: string; cliente?: string };
export type ClienteUsuarioRow = { id: string; full_name: string | null; email: string; telefone: string | null; active: boolean; created_at: string; obras: ObraOption[] };
export type CreateClienteUserInput = { nome: string; email: string; telefone?: string; password?: string; work_ids: string[] };

async function callEF(slug: string, body: unknown): Promise<Rec> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/' + slug, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const txt = await resp.text();
  const payload = txt ? JSON.parse(txt) as Rec : {};
  if (!resp.ok || payload.ok === false) throw new Error(String(payload.error ?? txt ?? 'Erro ' + resp.status));
  return payload;
}

export async function listClientesPortal(): Promise<ClienteOption[]> {
  const { data, error } = await db.from('lab_clients').select('id, razao_social, nome_fantasia').is('deleted_at', null).order('razao_social');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Rec[]).map((r) => ({ id: String(r.id), nome: String(r.razao_social ?? r.nome_fantasia ?? r.id) }));
}

export async function listObrasPortal(clientId?: string): Promise<ObraOption[]> {
  let q = db.from('client_works').select('id, nome, client_id, lab_clients(razao_social)').is('deleted_at', null).order('nome');
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Rec[]).map((r) => {
    const c = r.lab_clients && typeof r.lab_clients === 'object' ? r.lab_clients as Rec : {};
    return { id: String(r.id), nome: String(r.nome ?? r.id), client_id: String(r.client_id), cliente: String(c.razao_social ?? '') };
  });
}

export async function listClienteUsuarios(): Promise<ClienteUsuarioRow[]> {
  const { data, error } = await db.from('members')
    .select('id, full_name, email, telefone, active, created_at, member_obras(id, work_id, deleted_at, client_works(id, nome, client_id, lab_clients(razao_social)))')
    .eq('role', 'cliente')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Rec[]).map((m) => {
    const obras = ((m.member_obras as Rec[] | undefined) ?? [])
      .filter((mo) => !mo.deleted_at)
      .map((mo) => {
        const w = mo.client_works && typeof mo.client_works === 'object' ? mo.client_works as Rec : {};
        const c = w.lab_clients && typeof w.lab_clients === 'object' ? w.lab_clients as Rec : {};
        return { id: String(w.id ?? mo.work_id), nome: String(w.nome ?? mo.work_id), client_id: String(w.client_id ?? ''), cliente: String(c.razao_social ?? '') };
      });
    return { id: String(m.id), full_name: m.full_name as string | null, email: String(m.email), telefone: m.telefone as string | null, active: m.active !== false, created_at: String(m.created_at), obras };
  });
}

export async function createClienteUsuario(input: CreateClienteUserInput): Promise<{ username: string; temp_password: string }> {
  const r = await callEF('admin-create-client-user', input);
  return { username: String(r.username ?? input.email), temp_password: String(r.temp_password ?? input.password ?? '') };
}

export async function setClienteUsuarioAtivo(memberId: string, active: boolean): Promise<void> {
  const { error } = await db.from('members').update({ active, updated_at: new Date().toISOString() }).eq('id', memberId);
  if (error) throw new Error(error.message);
}

export async function replaceClienteUsuarioObras(memberId: string, tenantId: string, workIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  const { error: e1 } = await db.from('member_obras').update({ deleted_at: now }).eq('member_id', memberId).is('deleted_at', null);
  if (e1) throw new Error(e1.message);
  const rows = [...new Set(workIds)].map((work_id) => ({ tenant_id: tenantId, member_id: memberId, work_id }));
  if (!rows.length) return;
  const { error: e2 } = await db.from('member_obras').insert(rows);
  if (e2) throw new Error(e2.message);
}
