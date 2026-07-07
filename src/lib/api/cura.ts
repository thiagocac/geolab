import { supabase } from '../supabase';

// B3 — diário da câmara úmida / tanque (NBR 9479). Registro diário de temperatura + água de cal.
// Câmaras/tanques são equipamentos (tipo camara_umida/tanque); registros em cura_registros (mig 173).
const db = supabase as unknown as { from: (t: string) => any };

export type CuraEquip = { id: string; tipo: string; apelido: string | null; marca_modelo: string | null };
export type CuraRegistro = { id: string; equipamento_id: string; data: string; temperatura_c: number | null; cal_ok: boolean; conforme: boolean; responsavel: string | null; observacao: string | null };

export const TIPOS_CURA = ['camara_umida', 'tanque'] as const;

export async function listCamaras(): Promise<CuraEquip[]> {
  const { data, error } = await db.from('equipamentos').select('id, tipo, apelido, marca_modelo')
    .in('tipo', TIPOS_CURA as unknown as string[]).eq('ativo', true).is('deleted_at', null)
    .order('apelido', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), tipo: String(r.tipo), apelido: r.apelido ?? null, marca_modelo: r.marca_modelo ?? null }));
}

export async function listCuraRegistros(equipamentoId: string, desde: string): Promise<CuraRegistro[]> {
  const { data, error } = await db.from('cura_registros').select('id, equipamento_id, data, temperatura_c, cal_ok, conforme, responsavel, observacao')
    .eq('equipamento_id', equipamentoId).is('deleted_at', null).gte('data', desde).order('data', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: String(r.id), equipamento_id: String(r.equipamento_id), data: String(r.data),
    temperatura_c: r.temperatura_c == null ? null : Number(r.temperatura_c),
    cal_ok: r.cal_ok !== false, conforme: r.conforme !== false, responsavel: r.responsavel ?? null, observacao: r.observacao ?? null,
  }));
}

// conforme = água de cal ok E (sem leitura de temperatura OU temperatura dentro da faixa NBR 9479).
export function curaConforme(temp: number | null, calOk: boolean, min: number, max: number): boolean {
  if (!calOk) return false;
  if (temp == null) return true;
  return temp >= min && temp <= max;
}

// Upsert idempotente por (equipamento, dia) sem depender do índice parcial: lê e decide update/insert.
export async function upsertCuraRegistro(
  tenantId: string, equipamentoId: string,
  v: { data: string; temperatura_c: number | null; cal_ok: boolean; conforme: boolean; responsavel?: string | null; observacao?: string | null },
): Promise<void> {
  const existing = await db.from('cura_registros').select('id').eq('equipamento_id', equipamentoId).eq('data', v.data).is('deleted_at', null).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const values = { temperatura_c: v.temperatura_c, cal_ok: v.cal_ok, conforme: v.conforme, responsavel: v.responsavel ?? null, observacao: v.observacao ?? null };
  if (existing.data?.id) {
    const { error } = await db.from('cura_registros').update(values).eq('id', existing.data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('cura_registros').insert({ tenant_id: tenantId, equipamento_id: equipamentoId, data: v.data, ...values });
    if (error) throw new Error(error.message);
  }
}
