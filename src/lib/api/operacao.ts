import { supabase } from '../supabase';
import { env } from '../env';

// Operação interna. Criação de usuário/laboratório passa por EF service-role
// (admin-invite-member / admin-create-lab); leitura de members é direta (RLS por tenant).
const db = supabase as unknown as { from: (t: string) => any };

async function callEF(slug: string, body: unknown): Promise<Record<string, unknown>> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/' + slug, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || data.ok === false) throw new Error(String(data.error ?? 'Erro ' + resp.status));
  return data;
}

export type MemberRow = { id: string; full_name: string | null; email: string; cargo: string | null; role: string; active: boolean };

export async function listMembers(): Promise<MemberRow[]> {
  const { data, error } = await db.from('members').select('id, full_name, email, cargo, role, active').is('deleted_at', null).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberRow[];
}
export async function inviteMember(input: { full_name: string; email: string; role: string; cargo?: string; telefone?: string }): Promise<{ temp_password?: string | null }> {
  return callEF('admin-invite-member', input) as Promise<{ temp_password?: string | null }>;
}
export async function setMemberActive(id: string, active: boolean): Promise<void> {
  const { error } = await db.from('members').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function createLab(input: { lab_nome: string; lab_slug?: string; admin_email: string; admin_nome: string; cnpj?: string }): Promise<{ temp_password?: string | null; tenant_id?: string }> {
  return callEF('admin-create-lab', input) as Promise<{ temp_password?: string | null; tenant_id?: string }>;
}
