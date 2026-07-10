import { supabase } from '../supabase';

type Json = Record<string, unknown>;
const rpcClient = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
export type ConversionResult = { proposal_id: string; contract_id: string; work_id: string; idempotent: boolean };
export async function convertProposalToContractWork(payload: { proposalId: string; contractNumber?: string; work: Json; structures?: Json[] }): Promise<ConversionResult> {
  const { data, error } = await rpcClient.rpc('convert_proposal_to_contract_work', { p_proposal_id: payload.proposalId, p_contract_number: payload.contractNumber || null, p_work_payload: payload.work, p_structures: payload.structures ?? [] });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Json;
  return { proposal_id: String(row.proposal_id ?? ''), contract_id: String(row.contract_id ?? ''), work_id: String(row.work_id ?? ''), idempotent: row.idempotent === true };
}
