import { supabase } from '../supabase';

// Configuracao da assinatura do laudo (Onda 0 da feature de assinatura).
// Leitura: tabela lab_signature_settings (RLS member-gated, filtra pelo tenant selecionado).
// Escrita: RPC set_signature_settings (SECURITY DEFINER, gate laudo.assinar_config).
const db = supabase as unknown as { from: (t: string) => any };
const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type SignatureMode = 'nenhuma' | 'qr_publico' | 'imagem_rubrica' | 'a1_local' | 'nuvem_psc' | 'gateway_externo';
export type SignatureProvider = 'none' | 'local_a1' | 'integraicp' | 'birdid' | 'vidaas' | 'safeid' | 'neoid' | 'zapsign' | 'd4sign' | 'clicksign' | 'docusign' | 'govbr';
export type SignatureLevel = 'simples' | 'avancada' | 'qualificada';

export type SignatureSettings = {
  modo: SignatureMode;
  exigir_para_emissao: boolean;
  carimbo_tempo: boolean;
  ltv: boolean;
  titular_tipo: '' | 'e-cpf' | 'e-cnpj';
  titular_nome: string;
  titular_doc: string;
};

// Nivel juridico derivado do modo (fonte unica no front; o backend recalcula ao assinar).
export const NIVEL_POR_MODO: Record<SignatureMode, SignatureLevel> = {
  nenhuma: 'simples', qr_publico: 'simples', imagem_rubrica: 'simples',
  a1_local: 'qualificada', nuvem_psc: 'qualificada', gateway_externo: 'avancada',
};

// Provider padrao por modo (o provider fino de nuvem/gateway e escolhido nas Ondas 3+).
const PROVIDER_PADRAO: Record<SignatureMode, SignatureProvider> = {
  nenhuma: 'none', qr_publico: 'none', imagem_rubrica: 'none',
  a1_local: 'local_a1', nuvem_psc: 'integraicp', gateway_externo: 'none',
};

export const MODOS: { key: SignatureMode; label: string; desc: string; futuro?: boolean }[] = [
  { key: 'nenhuma', label: 'Sem assinatura', desc: 'O laudo sai sem QR e sem assinatura.' },
  { key: 'qr_publico', label: 'QR + validacao publica', desc: 'QR com validacao hospedada (comportamento atual).' },
  { key: 'imagem_rubrica', label: 'Imagem de assinatura', desc: 'Carimba uma imagem de rubrica do RT. Assinatura eletronica simples.' },
  { key: 'a1_local', label: 'Certificado A1 (ICP-Brasil)', desc: 'Assina com certificado A1 do laboratorio/RT. Qualificada, automatica.' },
  { key: 'nuvem_psc', label: 'Certificado em nuvem (ICP-Brasil)', desc: 'BirdID / VIDaaS / SafeID / NeoID. Qualificada; o RT autoriza no app.' },
  { key: 'gateway_externo', label: 'Gateway externo', desc: 'Plataformas externas de assinatura (fase futura).', futuro: true },
];

const DEFAULT: SignatureSettings = { modo: 'qr_publico', exigir_para_emissao: false, carimbo_tempo: false, ltv: false, titular_tipo: '', titular_nome: '', titular_doc: '' };

export async function getSignatureSettings(): Promise<SignatureSettings> {
  const { data, error } = await db.from('lab_signature_settings')
    .select('modo, exigir_para_emissao, carimbo_tempo, ltv, titular_tipo, titular_nome, titular_doc')
    .maybeSingle();
  if (error) throw new Error(error.message);
  const r = data as Record<string, unknown> | null;
  if (!r) return { ...DEFAULT };
  return {
    modo: (r.modo ?? 'qr_publico') as SignatureMode,
    exigir_para_emissao: !!r.exigir_para_emissao,
    carimbo_tempo: !!r.carimbo_tempo,
    ltv: !!r.ltv,
    titular_tipo: (r.titular_tipo ?? '') as SignatureSettings['titular_tipo'],
    titular_nome: (r.titular_nome ?? '') as string,
    titular_doc: (r.titular_doc ?? '') as string,
  };
}

export async function saveSignatureSettings(s: SignatureSettings): Promise<void> {
  const { error } = await rpc.rpc('set_signature_settings', {
    p_modo: s.modo,
    p_provider: PROVIDER_PADRAO[s.modo],
    p_nivel: NIVEL_POR_MODO[s.modo],
    p_exigir: s.exigir_para_emissao,
    p_carimbo: s.carimbo_tempo,
    p_ltv: s.ltv,
    p_titular_tipo: s.titular_tipo || null,
    p_titular_nome: s.titular_nome || null,
    p_titular_doc: s.titular_doc || null,
  });
  if (error) throw new Error(error.message);
}
