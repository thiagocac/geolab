import { supabase } from '../supabase';

// config_lab é singleton por tenant (PK tenant_id). Admin edita (RLS is_tenant_admin);
// membros leem. Alimenta a EF generate-laudo-ensaio-pdf (RT/CREA/acreditacao/toggles).
const db = supabase as unknown as { from: (t: string) => any };

export type ConfigLab = {
  responsavel_tecnico: string | null; crea_rt: string | null; acreditacao_inmetro: string | null; validade_acreditacao: string | null;
  idade_controle_default: number; cp_overdue_days: number; nota_rodape: string | null; laudo_campos: Record<string, boolean> | null;
};

export async function getConfigLab(tenantId: string): Promise<ConfigLab | null> {
  const { data, error } = await db.from('config_lab').select('responsavel_tecnico, crea_rt, acreditacao_inmetro, validade_acreditacao, idade_controle_default, cp_overdue_days, nota_rodape, laudo_campos').eq('tenant_id', tenantId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConfigLab | null;
}

export async function saveConfigLab(tenantId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('config_lab').upsert({ tenant_id: tenantId, ...values }, { onConflict: 'tenant_id' });
  if (error) throw new Error(error.message);
}
