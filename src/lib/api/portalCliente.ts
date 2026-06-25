import { supabase } from '../supabase';
import { env } from '../env';

const db = supabase as unknown as { from: (t: string) => any };

type Rec = Record<string, unknown>;
export type PortalWork = { id: string; nome: string; client_id: string; cliente: string };
export type PortalProgramacaoInput = { work_id: string; data_programada: string; hora_programada?: string; local_texto?: string; traco_texto?: string; fck_previsto?: number | null; fornecedor_texto?: string; volume_programado_m3?: number | null; observacoes?: string };
export type PortalConcretagem = { id: string; codigo: string | null; status: string; data_programada: string | null; data_real: string | null; local_texto: string | null; fck_previsto: number | null; client_works?: { nome: string | null } | null; lab_reports?: { id: string; numero: string; status: string; storage_path: string | null }[] | null; metadata?: Record<string, unknown> | null };
export type PortalLaudo = { id: string; numero: string; status: string; data_emissao: string | null; storage_path: string | null; concretagem_id: string | null; work_id?: string | null; client_works?: { nome: string | null } | null };

async function portalScope(): Promise<string[] | null> {
  const { data: userInfo } = await supabase.auth.getUser();
  const uid = userInfo.user?.id;
  if (!uid) return null;
  const { data: memberRows } = await db.from('members').select('id, role, roles').eq('auth_id', uid).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false }).limit(1);
  const m = ((memberRows ?? []) as Rec[])[0];
  if (!m) return null;
  const roles = Array.isArray(m.roles) ? m.roles.map(String) : [];
  const isCliente = m.role === 'cliente' || roles.includes('cliente');
  if (!isCliente) return null;
  const { data } = await db.from('member_obras').select('work_id').eq('member_id', String(m.id)).is('deleted_at', null);
  return ((data ?? []) as Rec[]).map((r) => String(r.work_id));
}

export async function listPortalWorks(): Promise<PortalWork[]> {
  const scope = await portalScope();
  if (scope && !scope.length) return [];
  let q = db.from('client_works').select('id, nome, client_id, lab_clients(razao_social)').is('deleted_at', null).order('nome');
  if (scope) q = q.in('id', scope);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Rec[]).map((r) => {
    const c = r.lab_clients && typeof r.lab_clients === 'object' ? r.lab_clients as Rec : {};
    return { id: String(r.id), nome: String(r.nome ?? r.id), client_id: String(r.client_id), cliente: String(c.razao_social ?? '') };
  });
}

export async function submitPortalProgramacoes(rows: PortalProgramacaoInput[]): Promise<number> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/client-portal-submit-programacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ rows }),
  });
  const txt = await resp.text();
  const payload = txt ? JSON.parse(txt) as Rec : {};
  if (!resp.ok) throw new Error(String(payload.error ?? txt ?? 'Erro ao enviar programação'));
  return Number(payload.inserted ?? rows.length);
}

export async function listPortalConcretagens(search = ''): Promise<PortalConcretagem[]> {
  const scope = await portalScope();
  if (scope && !scope.length) return [];
  let q = db.from('concretagens').select('id, codigo, status, data_programada, data_real, local_texto, fck_previsto, work_id, metadata, client_works(nome), lab_reports(id, numero, status, storage_path, deleted_at)').is('deleted_at', null).order('created_at', { ascending: false }).limit(80);
  if (scope) q = q.in('work_id', scope);
  if (search.trim()) q = q.or(`codigo.ilike.%${search.trim()}%,local_texto.ilike.%${search.trim()}%,traco_texto.ilike.%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as PortalConcretagem[]).map((r) => ({ ...r, lab_reports: (r.lab_reports ?? []).filter((l) => !((l as Rec).deleted_at)) }));
}

export async function listPortalLaudos(search = ''): Promise<PortalLaudo[]> {
  const scope = await portalScope();
  if (scope && !scope.length) return [];
  let q = db.from('lab_reports').select('id, numero, status, data_emissao, storage_path, concretagem_id, work_id, client_works(nome)').is('deleted_at', null).order('created_at', { ascending: false }).limit(80);
  if (scope) q = q.in('work_id', scope);
  if (search.trim()) q = q.ilike('numero', `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PortalLaudo[];
}

export async function openPortalLaudo(reportId: string): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/portal-laudo-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ lab_report_id: reportId }),
  });
  const txt = await resp.text();
  const payload = txt ? JSON.parse(txt) as Rec : {};
  if (!resp.ok || !payload.url) throw new Error(String(payload.error ?? 'Erro ao abrir laudo'));
  return String(payload.url);
}


// ---- Anexos da programacao/concretagem (EF portal-anexo, bucket privado anexos) ----
export type PortalAnexo = { path: string; filename: string; mime?: string; size?: number; uploaded_at?: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const s = String(reader.result ?? ''); resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s); };
    reader.onerror = () => reject(new Error('falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

async function callAnexo(body: Record<string, unknown>): Promise<Rec> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/portal-anexo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const txt = await resp.text();
  const payload = txt ? JSON.parse(txt) as Rec : {};
  if (!resp.ok || payload.ok === false) throw new Error(String(payload.error ?? 'Erro no anexo'));
  return payload;
}

export async function uploadPortalAnexo(concretagemId: string, file: File): Promise<PortalAnexo> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Arquivo acima de 8MB.');
  const content = await fileToBase64(file);
  const r = await callAnexo({ action: 'upload', concretagem_id: concretagemId, filename: file.name, mime: file.type, content_base64: content });
  return r.anexo as PortalAnexo;
}

export async function downloadPortalAnexo(path: string): Promise<string> {
  const r = await callAnexo({ action: 'download', path });
  return String(r.url);
}
