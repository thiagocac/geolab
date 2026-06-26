import { supabase } from '../supabase';

const db = supabase as unknown as { from: (t: string) => any };
const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type Comentario = {
  id: string; work_id: string; lab_report_id: string | null; concretagem_id: string | null;
  autor_nome: string | null; autor_tipo: 'cliente' | 'staff'; tipo: 'comentario' | 'contestacao';
  mensagem: string; resolvido_at: string | null; created_at: string;
};

// Leitura via RLS (cliente: member_can_access_work; staff: is_tenant_member).
export async function listComentarios(labReportId: string): Promise<Comentario[]> {
  const { data, error } = await db.from('portal_comentarios')
    .select('id, work_id, lab_report_id, concretagem_id, autor_nome, autor_tipo, tipo, mensagem, resolvido_at, created_at')
    .eq('lab_report_id', labReportId).is('deleted_at', null).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Comentario[];
}

export async function postarComentario(workId: string, mensagem: string, opts?: { labReportId?: string | null; concretagemId?: string | null; tipo?: 'comentario' | 'contestacao' }): Promise<void> {
  const { error } = await rpc.rpc('postar_comentario_portal', { p_work_id: workId, p_mensagem: mensagem, p_lab_report_id: opts?.labReportId ?? null, p_concretagem_id: opts?.concretagemId ?? null, p_tipo: opts?.tipo ?? 'comentario' });
  if (error) throw new Error(error.message);
}

export async function resolverComentario(id: string, resolvido = true): Promise<void> {
  const { error } = await rpc.rpc('resolver_comentario_portal', { p_id: id, p_resolvido: resolvido });
  if (error) throw new Error(error.message);
}
