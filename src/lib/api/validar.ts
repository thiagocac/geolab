import { z } from 'zod';
import { env } from '../env';

// Validacao publica do laudo (sem login). Chama a EF validar-laudo so com a anon key.
// Padrao Zod (v57): o schema e a fonte unica -> tipo via z.infer + validacao em runtime (safeParse)
// da resposta de rede nao confiavel deste endpoint publico (alvo do QR do laudo).
export const validacaoLaudoSchema = z.object({
  found: z.boolean(),
  numero: z.string().optional(),
  status: z.string().optional(),
  data_emissao: z.string().nullable().optional(),
  revisao: z.number().optional(),
  laboratorio: z.string().nullable().optional(),
  responsavel_tecnico: z.string().nullable().optional(),
  concretagem: z.string().nullable().optional(),
});
export type ValidacaoLaudo = z.infer<typeof validacaoLaudoSchema>;

export async function validarLaudo(codigo: string): Promise<ValidacaoLaudo> {
  const resp = await fetch(env.supabaseUrl + '/functions/v1/validar-laudo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify({ codigo }),
  });
  const json = await resp.json().catch(() => ({ found: false }));
  const parsed = validacaoLaudoSchema.safeParse(json);
  return parsed.success ? parsed.data : { found: false };
}
