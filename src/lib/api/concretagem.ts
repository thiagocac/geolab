import { supabase } from '../supabase';
import { env } from '../env';

const db = supabase as unknown as { from: (t: string) => any };

export type PadraoItem = { idade: number; unidade?: string; quantidade?: number };
export type ConcretagemRow = {
  id: string; codigo: string | null; status: string; origem: string;
  data_programada: string | null; data_real: string | null;
  fornecedor_texto: string | null; fck_previsto: number | null;
  dimensao_cp?: string | null; local_texto?: string | null; operational_material_id?: string | null;
  client_id: string; work_id: string;
  lab_clients?: { razao_social: string } | null;
  client_works?: { nome: string } | null;
  operational_materials?: { nome: string; padrao_moldagem?: PadraoItem[]; fck_mpa?: number } | null;
};
export type CaminhaoRow = { id: string; serie: number | null; nota_fiscal: string; placa: string | null; volume_m3: number | null; slump_medido_cm: number | null; temperatura_concreto_c: number | null };

const SEL = 'id, codigo, status, origem, data_programada, data_real, fornecedor_texto, fck_previsto, client_id, work_id, lab_clients(razao_social), client_works(nome), operational_materials(nome)';

export async function listConcretagens(workId?: string): Promise<ConcretagemRow[]> {
  let q = db.from('concretagens').select(SEL).is('deleted_at', null);
  if (workId) q = q.eq('work_id', workId);
  const { data, error } = await q.order('data_programada', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConcretagemRow[];
}

export async function getConcretagem(id: string): Promise<ConcretagemRow | null> {
  const { data, error } = await db.from('concretagens')
    .select('id, codigo, status, origem, data_programada, data_real, fornecedor_texto, fck_previsto, dimensao_cp, local_texto, operational_material_id, client_id, work_id, lab_clients(razao_social), client_works(nome), operational_materials(nome, padrao_moldagem, fck_mpa)')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConcretagemRow | null;
}

export async function createConcretagem(tenantId: string, values: Record<string, unknown>): Promise<{ id: string }> {
  const { data, error } = await db.from('concretagens').insert({ ...values, tenant_id: tenantId, status: 'rascunho', origem: values.origem ?? 'programada' }).select('id').single();
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function listCaminhoes(concId: string): Promise<CaminhaoRow[]> {
  const { data, error } = await db.from('material_receipts').select('id, serie, nota_fiscal, placa, volume_m3, slump_medido_cm, temperatura_concreto_c').eq('concretagem_id', concId).is('deleted_at', null).order('serie');
  if (error) throw new Error(error.message);
  return (data ?? []) as CaminhaoRow[];
}

function addDays(iso: string, days: number): string { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

// Cria caminhao + amostra + CPs pelo padrao de moldagem do traco (default NBR 5739: 2 CP de 28 dias).
export async function addCaminhao(tenantId: string, conc: ConcretagemRow, serie: number, values: Record<string, unknown>): Promise<void> {
  const { data: rec, error: e1 } = await db.from('material_receipts').insert({ ...values, tenant_id: tenantId, concretagem_id: conc.id, serie }).select('id').single();
  if (e1) throw new Error(e1.message);
  const receiptId = (rec as { id: string }).id;
  const hoje = (conc.data_real ?? conc.data_programada ?? new Date().toISOString().slice(0, 10));
  const base = conc.codigo ?? conc.id.slice(0, 6);
  const { data: am, error: e2 } = await db.from('amostras').insert({ tenant_id: tenantId, receipt_id: receiptId, concretagem_id: conc.id, codigo: 'AM-' + base + '-' + serie, data_moldagem: hoje, status: 'moldada' }).select('id').single();
  if (e2) throw new Error(e2.message);
  const amostraId = (am as { id: string }).id;
  const padrao: PadraoItem[] = (conc.operational_materials?.padrao_moldagem && conc.operational_materials.padrao_moldagem.length) ? conc.operational_materials.padrao_moldagem : [{ idade: 28, unidade: 'dia', quantidade: 2 }];
  const cps: Record<string, unknown>[] = [];
  let n = 1;
  for (const item of padrao) {
    const qtd = item.quantidade ?? 2;
    const unidade = item.unidade ?? 'dia';
    for (let i = 0; i < qtd; i++) {
      cps.push({ tenant_id: tenantId, amostra_id: amostraId, concretagem_id: conc.id, receipt_id: receiptId, material_test_type_id: null, codigo: 'CP-' + base + '-' + serie + '-' + String(n).padStart(2, '0'), idade_dias: item.idade, idade_unidade: unidade, data_moldagem: hoje, data_prevista_rompimento: unidade === 'dia' ? addDays(hoje, item.idade) : null, situacao: 'pendente', ordem: n });
      n++;
    }
  }
  if (cps.length) { const { error: e3 } = await db.from('corpos_prova').insert(cps); if (e3) throw new Error(e3.message); }
}

export async function invokeFicha(concId: string): Promise<Blob> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-ficha-moldagem-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ concretagem_id: concId }),
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(t || ('Erro ' + resp.status)); }
  return resp.blob();
}

export type CpDetalhe = { id: string; codigo: string | null; idade_dias: number | null; idade_unidade: string; situacao: string; receipt_id: string | null; resultado: number | null };
export async function listCpsDaConcretagem(concId: string): Promise<CpDetalhe[]> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, idade_dias, idade_unidade, situacao, receipt_id, ordem, material_tests(resultado_valor)')
    .eq('concretagem_id', concId).is('deleted_at', null).order('ordem', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => {
    const mts = Array.isArray(r.material_tests) ? r.material_tests : [];
    const last = mts.length ? Number(mts[mts.length - 1].resultado_valor) : NaN;
    return { id: String(r.id), codigo: r.codigo ?? null, idade_dias: r.idade_dias ?? null, idade_unidade: String(r.idade_unidade ?? 'dia'), situacao: String(r.situacao ?? 'pendente'), receipt_id: r.receipt_id ?? null, resultado: isFinite(last) ? last : null };
  });
}

// Traços com fck para o seletor de concretagem (auto-preenche fck_previsto).
export async function listTracosComFck(): Promise<{ value: string; label: string; fck: number | null }[]> {
  const { data, error } = await db.from('operational_materials').select('id, nome, fck_mpa').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ value: String(r.id), label: String(r.nome ?? r.id), fck: r.fck_mpa != null ? Number(r.fck_mpa) : null }));
}
