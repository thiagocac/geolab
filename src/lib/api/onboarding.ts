import { supabase } from '../supabase';

type Json = Record<string, unknown>;
const rpcClient = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const text = (value: unknown) => String(value ?? '');
const nullable = (value: unknown): string | null => value == null || value === '' ? null : String(value);
const num = (value: unknown) => Number(value) || 0;

export type OnboardingStep = {
  id: string; key: string; position: number; title: string; description: string | null; route: string | null;
  required: boolean; status: 'pendente' | 'concluido' | 'ignorado'; source: 'manual' | 'automatico'; completed_at: string | null;
};
export type OnboardingSnapshot = { run: { id: string; status: string; started_at: string; completed_at: string | null }; steps: OnboardingStep[]; progress: number };

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpcClient.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getOnboardingSnapshot(): Promise<OnboardingSnapshot> {
  const raw = await rpc<Json>('get_onboarding_snapshot');
  const run = (raw.run ?? {}) as Json;
  return {
    run: { id: text(run.id), status: text(run.status), started_at: text(run.started_at), completed_at: nullable(run.completed_at) },
    steps: ((raw.steps ?? []) as Json[]).map((row) => ({
      id: text(row.id), key: text(row.key), position: num(row.position), title: text(row.title), description: nullable(row.description), route: nullable(row.route),
      required: row.required !== false, status: (['concluido', 'ignorado'].includes(text(row.status)) ? text(row.status) : 'pendente') as OnboardingStep['status'],
      source: text(row.source) === 'automatico' ? 'automatico' : 'manual', completed_at: nullable(row.completed_at),
    })),
    progress: num(raw.progress),
  };
}

export async function setOnboardingStep(key: string, status: OnboardingStep['status']): Promise<OnboardingSnapshot> {
  return rpc('set_onboarding_step', { p_step_key: key, p_status: status });
}
export async function finishOnboarding(): Promise<OnboardingSnapshot> { return rpc('finish_onboarding'); }
