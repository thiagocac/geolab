import { supabase } from '../supabase';

type Json = Record<string, unknown>;
const rpcClient = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const text = (value: unknown) => String(value ?? '');
const nullable = (value: unknown): string | null => value == null || value === '' ? null : String(value);
const num = (value: unknown) => Number(value) || 0;
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> { const { data, error } = await rpcClient.rpc(name, args); if (error) throw new Error(error.message); return data as T; }

export type WeeklyProgram = { id: string; codigo: string | null; client_id: string; client_name: string; work_id: string; work_name: string; status: string; data_programada: string; hora_programada: string | null; local_texto: string | null; volume_programado_m3: number; formas_previstas: number; moldador_id: string | null; moldador: string | null; laboratorista_id: string | null; laboratorista: string | null; cps: number };
export type WeeklyRupture = { data: string; work_id: string; work_name: string; concretagem: string | null; cps: number; atrasados: number };
export type WeeklySnapshot = { from: string; to: string; kpis: { programacoes: number; rupturas: number; atrasados: number; conflitos: number }; programacoes: WeeklyProgram[]; rupturas: WeeklyRupture[]; shifts: Json[]; capacity: Json[]; bookings: Json[] };
export type WeeklyFilters = { from: string; to: string; clientId?: string; workId?: string; collaboratorId?: string };

export async function getWeeklyOperationsPlan(filters: WeeklyFilters): Promise<WeeklySnapshot> {
  const raw = await rpc<Json>('weekly_operations_plan', { p_from: filters.from, p_to: filters.to, p_client_id: filters.clientId || null, p_work_id: filters.workId || null, p_colaborador_id: filters.collaboratorId || null });
  const k = (raw.kpis ?? {}) as Json;
  return {
    from: text(raw.from), to: text(raw.to), kpis: { programacoes: num(k.programacoes), rupturas: num(k.rupturas), atrasados: num(k.atrasados), conflitos: num(k.conflitos) },
    programacoes: ((raw.programacoes ?? []) as Json[]).map((r) => ({ id: text(r.id), codigo: nullable(r.codigo), client_id: text(r.client_id), client_name: text(r.client_name), work_id: text(r.work_id), work_name: text(r.work_name), status: text(r.status), data_programada: text(r.data_programada), hora_programada: nullable(r.hora_programada), local_texto: nullable(r.local_texto), volume_programado_m3: num(r.volume_programado_m3), formas_previstas: num(r.formas_previstas), moldador_id: nullable(r.moldador_id), moldador: nullable(r.moldador), laboratorista_id: nullable(r.laboratorista_id), laboratorista: nullable(r.laboratorista), cps: num(r.cps) })),
    rupturas: ((raw.rupturas ?? []) as Json[]).map((r) => ({ data: text(r.data), work_id: text(r.work_id), work_name: text(r.work_name), concretagem: nullable(r.concretagem), cps: num(r.cps), atrasados: num(r.atrasados) })),
    shifts: (raw.shifts ?? []) as Json[], capacity: (raw.capacity ?? []) as Json[], bookings: (raw.bookings ?? []) as Json[],
  };
}

export async function assignWeeklyOperation(payload: { concretagemId: string; moldadorId?: string; laboratoristaId?: string; prensaId?: string; status?: string }): Promise<Json> {
  return rpc('assign_weekly_operation', { p_concretagem_id: payload.concretagemId, p_moldador_id: payload.moldadorId || null, p_laboratorista_id: payload.laboratoristaId || null, p_prensa_id: payload.prensaId || null, p_booking_status: payload.status ?? 'confirmado' });
}
