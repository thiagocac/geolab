import { supabase } from '../supabase';

// D2 — rota do dia do moldador: as obras das programações do moldador no dia (uma parada por obra).
const db = supabase as unknown as { from: (t: string) => any };

export type ParadaObra = {
  work_id: string; obra: string; cliente: string | null;
  endereco: string | null; cidade: string | null; uf: string | null;
  lat: number | null; lng: number | null; concretagens: number; horas: string[];
};

export async function programacoesDoMoldador(data: string, moldadorId: string): Promise<ParadaObra[]> {
  const { data: rows, error } = await db.from('concretagens')
    .select('id, hora_programada, work_id, client_works(nome, endereco, cidade, uf, lat, lng), lab_clients(razao_social)')
    .is('deleted_at', null).eq('moldador_id', moldadorId).neq('status', 'cancelada')
    .or(`data_programada.eq.${data},data_real.eq.${data}`);
  if (error) throw new Error(error.message);
  const seen = new Map<string, ParadaObra>();
  for (const r of (rows ?? []) as Record<string, any>[]) {
    if (!r.work_id) continue;
    const w = r.client_works ?? {};
    const key = String(r.work_id);
    const cur = seen.get(key);
    if (cur) { cur.concretagens += 1; if (r.hora_programada) cur.horas.push(String(r.hora_programada)); }
    else seen.set(key, {
      work_id: key, obra: String(w.nome ?? '—'), cliente: r.lab_clients?.razao_social ?? null,
      endereco: w.endereco ?? null, cidade: w.cidade ?? null, uf: w.uf ?? null,
      lat: w.lat ?? null, lng: w.lng ?? null, concretagens: 1, horas: r.hora_programada ? [String(r.hora_programada)] : [],
    });
  }
  return [...seen.values()];
}
