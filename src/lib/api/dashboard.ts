import { supabase } from '../supabase';
import { listAgenda } from './rompimento';

// KPIs do painel a partir das tabelas existentes (RLS por tenant).
const db = supabase as unknown as { from: (t: string) => any };

export type Kpis = {
  agenda: { atrasados: number; hoje: number; proximos: number; total: number };
  laudos: { rascunho: number; emitido: number; total: number };
  calibracoesVencendo: number;
};

export async function getKpis(): Promise<Kpis> {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const agenda = await listAgenda();
  const a = { atrasados: 0, hoje: 0, proximos: 0, total: agenda.length };
  for (const c of agenda) {
    const d = c.data_prevista_rompimento;
    if (d && d < today) a.atrasados++;
    else if (d === today) a.hoje++;
    else if (d && d > today) a.proximos++;
  }
  const { data: laudos } = await db.from('lab_reports').select('status').is('deleted_at', null);
  const l = { rascunho: 0, emitido: 0, total: (laudos ?? []).length };
  for (const r of (laudos ?? []) as Record<string, unknown>[]) { if (r.status === 'emitido') l.emitido++; else l.rascunho++; }
  const { data: eqs } = await db.from('equipamentos').select('validade_calibracao').is('deleted_at', null).not('validade_calibracao', 'is', null).lte('validade_calibracao', in30);
  return { agenda: a, laudos: l, calibracoesVencendo: (eqs ?? []).length };
}
