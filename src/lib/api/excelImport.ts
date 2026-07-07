import { supabase } from '../supabase';
import { trackDomainEvent } from '../telemetry';
import type { ImportResource } from '../importacao/excelModel';

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type ImportCommitResult = { batch_id: string | null; inserted: number; updated: number; skipped: number; errors: Array<{ row: number; message: string }> };

export async function commitExcelImport(resource: ImportResource, rows: Array<Record<string, unknown>>, dryRun = false): Promise<ImportCommitResult> {
  const { data, error } = await db.rpc('commit_excel_import', { p_resource: resource, p_rows: rows, p_dry_run: dryRun });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Partial<ImportCommitResult>;
  if (!dryRun) trackDomainEvent('importacao.confirmada', { origem: 'excel', recurso: resource, inseridos: Number(r.inserted ?? 0), atualizados: Number(r.updated ?? 0) });
  return { batch_id: r.batch_id ?? null, inserted: Number(r.inserted ?? 0), updated: Number(r.updated ?? 0), skipped: Number(r.skipped ?? 0), errors: (r.errors ?? []) as Array<{ row: number; message: string }> };
}
