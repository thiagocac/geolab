import { useState } from 'react';
import { useConfirm } from '../ui/ConfirmDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
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
  initialSort?: string; filter?: Record<string, string>; canDelete?: boolean;
};

const PAGE = 20;

export function AdminListPage<T extends DomainRow = DomainRow>({ title, kicker, description, table, columns, fields, rowActions, initialSort, filter, canDelete }: Props<T>) {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ column: initialSort ?? 'created_at', direction: 'asc' });
  const [editing, setEditing] = useState<T | null | undefined>(undefined);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState<string | null>(null);

  const query = useQuery({ queryKey: [table, page, search, sort, filter], queryFn: () => listRows<T>(table, { page, pageSize: PAGE, search, sort, filter }) });
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;

  function openNew() { setForm({ ...(filter ?? {}) }); setEditing(null); setErr(null); }
  function openEdit(row: T) { const f: Record<string, unknown> = {}; for (const fs of fields) f[fs.key] = (row as Record<string, unknown>)[fs.key]; setForm(f); setEditing(row); setErr(null); }
  function close() { setEditing(undefined); setForm({}); setErr(null); }

  async function runLookup(spec: FieldSpec) {
    if (!spec.lookup) return;
    const raw = String(form[spec.key] ?? '').trim();
    if (!raw) { toast('Informe o ' + spec.lookup.kind.toUpperCase() + ' primeiro.', 'error'); return; }
    setLookupBusy(spec.key);
    try {
      const data = await consultaFiscal(spec.lookup.kind, raw);
      setForm((s) => { const next = { ...s }; for (const [src, dest] of Object.entries(spec.lookup!.map)) { const v = (data as Record<string, unknown>)[src]; if (v != null && v !== '') next[dest] = v; } return next; });
      toast('Dados preenchidos.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setLookupBusy(null); }
  }

  async function save() {
    if (!member) return;
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        const val = form[f.key];
        if (f.required && (val === undefined || val === '' || val === null)) throw new Error('Campo obrigatorio: ' + f.label);
        if (val !== undefined) payload[f.key] = val === '' ? null : val;
      }
      if (editing) await updateRow(table, editing.id, payload); else await createRow(table, member.tenant_id, payload);
      await qc.invalidateQueries({ queryKey: [table] });
      toast(editing ? 'Registro atualizado.' : 'Registro criado.', 'success');
      close();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(row: T) {
    if (!(await confirm({ title: 'Excluir registro', message: 'Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Excluir' }))) return;
    try { await softDelete(table, row.id); await qc.invalidateQueries({ queryKey: [table] }); toast('Registro excluido.', 'success'); }
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
        <Button onClick={openNew}>Novo</Button>
      </div>
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={(query.error as Error).message} /> : <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} sort={sort} onSort={setSort} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>
        <span>{total} registro(s)</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <Button variant="ghost" disabled={page * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Proxima</Button>
        </span>
      </div>
      <Modal open={editing !== undefined} title={editing ? 'Editar - ' + title : 'Novo - ' + title} onClose={close} footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button onClick={() => void save()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          {fields.map((f) => f.lookup ? (
            <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
              <FieldRenderer spec={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
              <Button variant="secondary" disabled={lookupBusy === f.key} onClick={() => void runLookup(f)}>{lookupBusy === f.key ? '...' : 'Buscar'}</Button>
            </div>
          ) : (
            <FieldRenderer key={f.key} spec={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
          ))}
          {err ? <div style={{ color: 'var(--magenta)', fontSize: 13 }}>{err}</div> : null}
        </div>
      </Modal>
    </div>
  );
}

function FieldRenderer({ spec, value, onChange }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  if (spec.type === 'reference') return <ReferenceField spec={spec} value={value == null ? '' : String(value)} onChange={onChange} />;
  if (spec.type === 'select') return <SelectField label={spec.label} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value || null)}><option value="">-</option>{(spec.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>;
  if (spec.type === 'textarea') return <TextArea label={spec.label} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />;
  if (spec.type === 'boolean') return <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14 }}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {spec.label}</label>;
  const t = spec.type === 'number' ? 'number' : spec.type === 'date' ? 'date' : 'text';
  return <Field label={spec.label} type={t} value={value == null ? '' : String(value)} onChange={(e) => onChange(spec.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} />;
}

function ReferenceField({ spec, value, onChange }: { spec: FieldSpec; value: string; onChange: (v: unknown) => void }) {
  const q = useQuery({ queryKey: ['ref', spec.refTable, spec.refFilter], queryFn: () => listReference(spec.refTable as string, spec.refLabel ?? 'nome', spec.refFilter) });
  return <SelectField label={spec.label} value={value} onChange={(e) => onChange(e.target.value || null)}><option value="">-</option>{(q.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>;
}
