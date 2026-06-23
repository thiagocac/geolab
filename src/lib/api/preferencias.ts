import { supabase } from '../supabase';

// config_lab é singleton por tenant (PK tenant_id). Admin edita (RLS is_tenant_admin);
// membros leem. Alimenta a EF generate-laudo-ensaio-pdf (RT/CREA/acreditacao/toggles).
const db = supabase as unknown as { from: (t: string) => any };

export type ConfigLab = {
  responsavel_tecnico: string | null; crea_rt: string | null; acreditacao_inmetro: string | null; validade_acreditacao: string | null;
  idade_controle_default: number; cp_overdue_days: number; nota_rodape: string | null; logo_path: string | null; ensaio_campos: Record<string, boolean> | null; laudo_campos: Record<string, boolean> | null;
};

export async function getConfigLab(tenantId: string): Promise<ConfigLab | null> {
  const { data, error } = await db.from('config_lab').select('responsavel_tecnico, crea_rt, acreditacao_inmetro, validade_acreditacao, idade_controle_default, cp_overdue_days, nota_rodape, logo_path, ensaio_campos, laudo_campos').eq('tenant_id', tenantId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConfigLab | null;
}

export async function saveConfigLab(tenantId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('config_lab').upsert({ tenant_id: tenantId, ...values }, { onConflict: 'tenant_id' });
  if (error) throw new Error(error.message);
}

export async function uploadLogo(tenantId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const final = ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'png';
  const path = tenantId + '/logos/logo.' + final;
  const { error } = await supabase.storage.from('lab-reports').upload(path, file, { upsert: true, contentType: file.type || ('image/' + final) });
  if (error) throw new Error(error.message);
  return path;
}
export async function logoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('lab-reports').createSignedUrl(path, 300);
  if (error) return null;
  return data.signedUrl;
}
