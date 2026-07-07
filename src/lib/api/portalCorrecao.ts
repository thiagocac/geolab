import { supabase } from '../supabase';
import type { PortalCorrecao, PortalCorrecaoConfig, PortalCorrecaoInput } from '../portal/types';

const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const db = supabase as unknown as { from: (t: string) => any };
type Rec = Record<string, unknown>;

// Portal autenticado (cliente): abre um pedido de correcao via RPC escopada.
export async function submitPortalCorrecao(input: PortalCorrecaoInput): Promise<string> {
  const { data, error } = await rpc.rpc('portal_solicitar_correcao', {
    p_work_id: input.work_id, p_tipo: input.tipo,
    p_lab_report_id: input.lab_report_id ?? null, p_concretagem_id: input.concretagem_id ?? null,
    p_receipt_id: input.receipt_id ?? null, p_corpo_prova_id: input.corpo_prova_id ?? null,
    p_material_test_id: null, p_valor_proposto: input.valor_proposto ?? null, p_comentario: input.comentario ?? null,
  });
  if (error) throw new Error(error.message);
  return String(data ?? '');
}

export async function getPortalCorrecaoConfig(): Promise<PortalCorrecaoConfig | null> {
  const { data, error } = await rpc.rpc('portal_correcao_config');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') return null;
  const o = data as Rec;
  return {
    correcao_habilitada: o.correcao_habilitada !== false,
    correcao_auto_edicao_peca: o.correcao_auto_edicao_peca === true,
    correcao_resultado: o.correcao_resultado !== false,
  };
}

export async function listMeusPedidosCorrecao(workId?: string): Promise<PortalCorrecao[]> {
  const { data, error } = await rpc.rpc('portal_meus_pedidos_correcao', { p_work_id: workId ?? null });
  if (error) throw new Error(error.message);
  return (data ?? []) as PortalCorrecao[];
}

// Staff: lista pedidos do tenant (RLS is_tenant_member) e decide.
export async function listCorrecoesStaff(status?: string): Promise<PortalCorrecao[]> {
  let q = db.from('portal_correcao_pedidos')
    .select('id, tipo, status, campo_alvo, valor_atual, valor_proposto, comentario_cliente, decisao_comentario, created_at, decided_at, nova_revisao, work_id, lab_report_id, concretagem_id, client_works(nome), lab_reports(numero), concretagens(codigo)')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Rec[]).map((r) => ({
    id: String(r.id), tipo: String(r.tipo), status: String(r.status), campo_alvo: (r.campo_alvo as string | null) ?? null,
    valor_atual: (r.valor_atual as string | null) ?? null, valor_proposto: (r.valor_proposto as string | null) ?? null,
    comentario_cliente: (r.comentario_cliente as string | null) ?? null, decisao_comentario: (r.decisao_comentario as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null, decided_at: (r.decided_at as string | null) ?? null,
    nova_revisao: (r.nova_revisao as number | null) ?? null, work_id: (r.work_id as string | null) ?? null,
    work_nome: (r.client_works as Rec | null)?.nome as string ?? null, lab_report_id: (r.lab_report_id as string | null) ?? null,
    lab_report_numero: (r.lab_reports as Rec | null)?.numero as string ?? null, concretagem_id: (r.concretagem_id as string | null) ?? null,
    concretagem_codigo: (r.concretagens as Rec | null)?.codigo as string ?? null,
  }));
}

export async function decidirCorrecao(id: string, decisao: 'aprovar' | 'rejeitar' | 'em_analise', comentario?: string, valorFinal?: string): Promise<Record<string, unknown>> {
  const { data, error } = await rpc.rpc('portal_correcao_decidir', { p_id: id, p_decisao: decisao, p_comentario: comentario ?? null, p_valor_final: valorFinal ?? null });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}
