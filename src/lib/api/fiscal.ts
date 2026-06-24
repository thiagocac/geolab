import { supabase } from '../supabase';
import { env } from '../env';

export type FiscalKind = 'cnpj' | 'cep';

// Lookup fiscal (CNPJ/CEP) via EF consulta-fiscal (BrasilAPI). Retorna campos normalizados
// para preencher o formulario de cadastro de cliente/obra. v1.1.
export async function consultaFiscal(kind: FiscalKind, valor: string): Promise<Record<string, unknown>> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/consulta-fiscal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ kind, valor }),
  });
  const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: Record<string, unknown> };
  if (!resp.ok || data.ok === false) {
    const e = String(data.error ?? 'Erro ' + resp.status);
    const msg = e === 'nao_encontrado' ? 'Documento nao encontrado.' : e === 'cnpj_invalido' ? 'CNPJ invalido.' : e === 'cep_invalido' ? 'CEP invalido.' : e;
    throw new Error(msg);
  }
  return data.data ?? {};
}
