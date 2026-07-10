import { useCallback, useMemo, useState } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { useConfirm } from '../ui/ConfirmDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { DataTable } from '../ui/DataTable';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Field, TextArea, SelectField } from '../ui/Field';
import { PageHeader } from '../ui/PageHeader';
import { LoadingState, ErrorState } from '../ui/State';
import { listRows, listReference } from '../../lib/api/client';
import { createRow, updateRow, softDelete } from '../../lib/api/mutations';
import { consultaFiscal } from '../../lib/api/fiscal';
import type { Column, FieldSpec, RowAction, DomainRow, SortState } from '../../lib/api/types';

type Props<T extends DomainRow> = {
  title: string; kicker?: string; description?: string; table: string;
  columns: Column<T>[]; fields: FieldSpec[]; rowActions?: RowAction<T>[];
  initialSort?: string; filter?: Record<string, string>; canDelete?: boolean; canCreate?: boolean;
};

type FormVals = Record<string, unknown>;
const PAGE = 20;

function deriveValue(transform: string, v: unknown): string {
  const s = String(v ?? '');
  if (transform === 'first4letters') return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
  return s;
}

export function AdminListPage<T extends DomainRow = DomainRow>({ title, kicker, description, table, columns, fields, rowActions, initialSort, filter, canDelete, canCreate }: Props<T>) {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ column: initialSort ?? 'created_at', direction: 'asc' });
  const [editing, setEditing] = useState<T | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState<string | null>(null);

  // Esquema Zod derivado dos campos (obrigatoriedade + tipo)
  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const f of fields) {
      if (f.required && f.type !== 'boolean') {
        shape[f.key] = f.type === 'number'
          ? z.number({ error: 'Campo obrigatório' })
          : z.string({ error: 'Campo obrigatório' }).trim().min(1, 'Campo obrigatório');
      } else {
        shape[f.key] = z.any();
      }
    }
    return z.object(shape);
  }, [fields]);

  // Resolver Zod customizado (sem @hookform/resolvers — robusto a versao do Zod)
  const resolver = useCallback<Resolver<FormVals>>((values) => {
    const r = schema.safeParse(values);
    if (r.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of r.error.issues) { const k = String(issue.path[0] ?? ''); if (k && !errors[k]) errors[k] = { type: String(issue.code), message: issue.message }; }
    return { values: {}, errors };
  }, [schema]);

  const { control, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<FormVals>({ resolver });

  const query = useQuery({ queryKey: [table, page, search, sort, filter], queryFn: () => listRows<T>(table, { page, pageSize: PAGE, search, sort, filter }) });
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;

  function openNew() { reset({ ...(filter ?? {}) }); setEditing(null); setErr(null); }
  function openEdit(row: T) { const f: FormVals = {}; for (const fs of fields) f[fs.key] = (row as Record<string, unknown>)[fs.key]; reset(f); setEditing(row); setErr(null); }
  function close() { setEditing(undefined); reset({}); setErr(null); }

  async function runLookup(spec: FieldSpec) {
    if (!spec.lookup) return;
    const raw = String(getValues(spec.key) ?? '').trim();
    if (!raw) { toast('Informe o ' + spec.lookup.kind.toUpperCase() + ' primeiro.', 'error'); return; }
    setLookupBusy(spec.key);
    try {
      const data = await consultaFiscal(spec.lookup.kind, raw);
      for (const [src, dest] of Object.entries(spec.lookup.map)) { const v = (data as Record<string, unknown>)[src]; if (v != null && v !== '') setValue(dest, v, { shouldDirty: true, shouldValidate: true }); }
      toast('Dados preenchidos.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setLookupBusy(null); }
  }

  function applyChange(spec: FieldSpec, value: unknown, base: (v: unknown) => void) {
    base(value);
    for (const d of fields) {
      if (d.derive?.from === spec.key) {
        const cur = getValues(d.key);
        if (cur == null || String(cur).trim() === '') setValue(d.key, deriveValue(d.derive.transform, value), { shouldDirty: false });
      }
    }
  }

  async function onValid(values: FormVals) {
    if (!member) return;
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) { const val = values[f.key]; if (val !== undefined) payload[f.key] = val === '' ? null : val; }
      if (editing) await updateRow(table, editing.id, payload); else await createRow(table, member.tenant_id, payload);
      await qc.invalidateQueries({ queryKey: [table] });
      toast(editing ? 'Registro atualizado.' : 'Registro criado.', 'success');
      close();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(row: T) {
    if (!(await confirm({ title: 'Excluir registro', message: 'Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Excluir' }))) return;
    try { await softDelete(table, row.id); await qc.invalidateQueries({ queryKey: [table] }); toast('Registro excluído.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  const actionsCol: Column<T> = { key: '__actions', header: '', render: (row) => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      {(rowActions ?? []).filter((a) => !a.show || a.show(row)).map((a, i) => <Button key={i} variant={a.variant ?? 'ghost'} onClick={() => void a.run(row)}>{a.label}</Button>)}
      <Button variant="ghost" onClick={() => openEdit(row)}>Editar</Button>
      {canDelete ? <Button variant="ghost" onClick={() => void remove(row)}>Excluir</Button> : null}
    </div>
  ) };
  const cols = [...columns, actionsCol];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker={kicker} title={title} description={description} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 280 }} />
        {canCreate === false ? null : <Button onClick={openNew}>Novo</Button>}
      </div>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} sort={sort} onSort={setSort} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>
        <span>{total} registro(s)</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <Button variant="ghost" disabled={page * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </span>
      </div>
      <Drawer open={editing !== undefined} title={editing ? 'Editar - ' + title : 'Novo - ' + title} onClose={close} footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button onClick={() => void handleSubmit(onValid)()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          {fields.map((f) => (
            <Controller key={f.key} name={f.key} control={control} render={({ field }) => f.lookup ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
                <FieldRenderer spec={f} value={field.value} onChange={(v) => applyChange(f, v, field.onChange)} error={errors[f.key]?.message as string | undefined} />
                <Button variant="secondary" disabled={lookupBusy === f.key} onClick={() => void runLookup(f)}>{lookupBusy === f.key ? '...' : 'Buscar'}</Button>
              </div>
            ) : (
              <FieldRenderer spec={f} value={field.value} onChange={(v) => applyChange(f, v, field.onChange)} error={errors[f.key]?.message as string | undefined} />
            )} />
          ))}
          {err ? <div style={{ color: 'var(--magenta)', fontSize: 13 }}>{err}</div> : null}
        </div>
      </Drawer>
    </div>
  );
}

function FieldRenderer({ spec, value, onChange, error }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void; error?: string }) {
  if (spec.type === 'reference') return <ReferenceField spec={spec} value={value == null ? '' : String(value)} onChange={onChange} error={error} />;
  if (spec.type === 'select') return <SelectField label={spec.label} required={spec.required} error={error} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value || null)}><option value="">-</option>{(spec.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>;
  if (spec.type === 'textarea') return <TextArea label={spec.label} required={spec.required} error={error} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />;
  if (spec.type === 'boolean') return <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14 }}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {spec.label}</label>;
  const t = spec.type === 'number' ? 'number' : spec.type === 'date' ? 'date' : 'text';
  return <Field label={spec.label} required={spec.required} hint={spec.help} error={error} type={t} value={value == null ? '' : String(value)} onChange={(e) => onChange(spec.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} />;
}

function ReferenceField({ spec, value, onChange, error }: { spec: FieldSpec; value: string; onChange: (v: unknown) => void; error?: string }) {
  const q = useQuery({ queryKey: ['ref', spec.refTable, spec.refFilter], staleTime: 5 * 60 * 1000, queryFn: () => listReference(spec.refTable as string, spec.refLabel ?? 'nome', spec.refFilter) });
  return <SelectField label={spec.label} required={spec.required} error={error} value={value} onChange={(e) => onChange(e.target.value || null)}><option value="">-</option>{(q.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>;
}
