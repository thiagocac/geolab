import { supabase } from '../supabase';

const db = supabase as unknown as { from: (t: string) => any };

// Recursos do portal que podem ser delimitados por usuário do cliente.
export type FeatureKey = 'ver_resultados' | 'baixar_laudo' | 'ver_agenda' | 'ver_medicao' | 'ver_nc' | 'ver_dossie' | 'programar' | 'cancelar_programacao' | 'anexar' | 'comentar' | 'contestar';
export type PortalPermissoes = Record<FeatureKey, boolean>;

export const FEATURES: { key: FeatureKey; label: string; hint?: string }[] = [
  { key: 'ver_resultados', label: 'Ver resultados e laudos' },
  { key: 'baixar_laudo', label: 'Baixar PDF do laudo' },
  { key: 'ver_agenda', label: 'Ver agenda de rompimentos' },
  { key: 'ver_medicao', label: 'Ver medição / faturamento' },
  { key: 'ver_nc', label: 'Ver não conformidades' },
  { key: 'ver_dossie', label: 'Baixar dossiê da obra' },
  { key: 'programar', label: 'Enviar programação de concretagem' },
  { key: 'cancelar_programacao', label: 'Cancelar programação pendente' },
  { key: 'anexar', label: 'Anexar NF/DANFE à programação' },
  { key: 'comentar', label: 'Comentar em laudos' },
  { key: 'contestar', label: 'Contestar resultados' },
];

const ALL_TRUE: PortalPermissoes = { ver_resultados: true, baixar_laudo: true, ver_agenda: true, ver_medicao: true, ver_nc: true, ver_dossie: true, programar: true, cancelar_programacao: true, anexar: true, comentar: true, contestar: true };

export const PERFIS: { key: string; label: string; perms: PortalPermissoes }[] = [
  { key: 'leitor', label: 'Leitor (só consulta)', perms: { ...ALL_TRUE, programar: false, cancelar_programacao: false, anexar: false, comentar: false, contestar: false } },
  { key: 'operacional', label: 'Operacional (programa e comenta)', perms: { ...ALL_TRUE, cancelar_programacao: false, contestar: false } },
  { key: 'completo', label: 'Completo (todos os recursos)', perms: { ...ALL_TRUE } },
];

// Permissivo por padrão: cliente sem config = tudo liberado; só false explícito bloqueia. Staff = tudo.
export function resolvePermissoes(isCliente: boolean, raw: unknown): PortalPermissoes {
  if (!isCliente) return { ...ALL_TRUE };
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : null;
  const out = { ...ALL_TRUE };
  for (const f of FEATURES) out[f.key] = o ? o[f.key] !== false : true;
  return out;
}

export function perfilDe(perms: PortalPermissoes): string {
  for (const p of PERFIS) if (FEATURES.every((f) => p.perms[f.key] === perms[f.key])) return p.key;
  return 'personalizado';
}

export async function getMinhasPermissoes(): Promise<PortalPermissoes> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return { ...ALL_TRUE };
  const { data } = await db.from('members').select('role, roles, portal_permissoes').eq('auth_id', uid).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false }).limit(1).maybeSingle();
  const role = String(data?.role ?? '');
  const roles = Array.isArray(data?.roles) ? (data.roles as unknown[]).map(String) : [];
  const isCliente = role === 'cliente' || roles.includes('cliente');
  return resolvePermissoes(isCliente, data?.portal_permissoes ?? null);
}
