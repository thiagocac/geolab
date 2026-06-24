import { env } from '../env';

// Validacao publica do laudo (sem login). Chama a EF validar-laudo so com a anon key.
export type ValidacaoLaudo = { found: boolean; numero?: string; status?: string; data_emissao?: string | null; revisao?: number; laboratorio?: string | null; responsavel_tecnico?: string | null; concretagem?: string | null };

export async function validarLaudo(codigo: string): Promise<ValidacaoLaudo> {
  const resp = await fetch(env.supabaseUrl + '/functions/v1/validar-laudo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify({ codigo }),
  });
  return (await resp.json().catch(() => ({ found: false }))) as ValidacaoLaudo;
}
