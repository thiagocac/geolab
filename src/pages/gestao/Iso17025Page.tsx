import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, SelectField } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import {
  convertIsoFindingToNc,
  createIsoAssessment,
  getIsoSnapshot,
  listCompetenceRecords,
  listInternalAudits,
  listIsoAssessments,
  listIsoFindings,
  listProficiencyRounds,
  updateIsoAssessmentItem,
} from '../../lib/api/productEvolution';
import { useToast } from '../../lib/toast';
import { dateBr, MetricCard, Pill, TableShell, Tabs, Td, Th } from './product/ProductUi';

type Tab = 'readiness' | 'findings' | 'competence' | 'proficiency' | 'audits';
type GenericRow = Record<string, unknown>;

export function Iso17025Page() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('readiness');
  const [selected, setSelected] = useState('');
  const [title, setTitle] = useState('Avaliação ISO/IEC 17025');
  const [busy, setBusy] = useState(false);

  const assessments = useQuery({ queryKey: ['product', 'iso-assessments'], queryFn: listIsoAssessments });
  const snapshot = useQuery({
    queryKey: ['product', 'iso-snapshot', selected],
    queryFn: () => getIsoSnapshot(selected),
    enabled: Boolean(selected),
  });
  const findings = useQuery({ queryKey: ['product', 'iso-findings'], queryFn: listIsoFindings });
  const competence = useQuery({ queryKey: ['product', 'iso-competence'], queryFn: listCompetenceRecords });
  const proficiency = useQuery({ queryKey: ['product', 'iso-proficiency'], queryFn: listProficiencyRounds });
  const audits = useQuery({ queryKey: ['product', 'iso-audits'], queryFn: listInternalAudits });

  const openFindings = findings.data ?? [];
  const counts = useMemo(() => ({
    assessments: assessments.data?.length ?? 0,
    findings: openFindings.length,
    competence: competence.data?.length ?? 0,
  }), [assessments.data?.length, openFindings.length, competence.data?.length]);

  async function createAssessment() {
    setBusy(true);
    try {
      const id = await createIsoAssessment(title);
      setSelected(id);
      await qc.invalidateQueries({ queryKey: ['product', 'iso-assessments'] });
      toast('Avaliação criada com checklist padrão.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao criar avaliação.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function classify(id: string, situation: string) {
    setBusy(true);
    try {
      await updateIsoAssessmentItem(id, situation);
      await qc.invalidateQueries({ queryKey: ['product', 'iso-snapshot', selected] });
      toast('Requisito atualizado.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao atualizar requisito.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function convertToNc(id: string) {
    setBusy(true);
    try {
      const nc = await convertIsoFindingToNc(id);
      await qc.invalidateQueries({ queryKey: ['product', 'iso-findings'] });
      toast(`NC criada: ${nc.slice(0, 8)}.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao converter achado.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Evolução do produto"
        title="Prontidão ISO/IEC 17025"
        description="Checklist de apoio gerencial, evidências, competência, proficiência e auditorias. Não representa certificação."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Avaliações" value={counts.assessments} />
        <MetricCard label="Achados abertos" value={counts.findings} tone={counts.findings ? 'warn' : 'good'} />
        <MetricCard label="Registros de competência" value={counts.competence} />
      </div>

      <Tabs
        active={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { key: 'readiness', label: 'Prontidão' },
          { key: 'findings', label: 'Achados', count: counts.findings },
          { key: 'competence', label: 'Competência' },
          { key: 'proficiency', label: 'Proficiência' },
          { key: 'audits', label: 'Auditorias' },
        ]}
      />

      {tab === 'readiness' ? (
        <ReadinessPanel
          title={title}
          setTitle={setTitle}
          selected={selected}
          setSelected={setSelected}
          busy={busy}
          assessments={assessments.data ?? []}
          assessmentsLoading={assessments.isLoading}
          assessmentsError={assessments.error as Error | null}
          snapshot={snapshot.data}
          snapshotLoading={snapshot.isLoading}
          snapshotError={snapshot.error as Error | null}
          onCreate={createAssessment}
          onClassify={classify}
        />
      ) : null}

      {tab === 'findings' ? (
        <FindingsPanel
          rows={openFindings}
          loading={findings.isLoading}
          error={findings.error as Error | null}
          busy={busy}
          onConvert={convertToNc}
        />
      ) : null}

      {tab === 'competence' ? (
        <GenericRows
          title="Matriz de competência"
          loading={competence.isLoading}
          error={competence.error as Error | null}
          rows={(competence.data ?? []) as GenericRow[]}
          columns={['competence_key', 'escopo', 'status', 'valid_until']}
        />
      ) : null}

      {tab === 'proficiency' ? (
        <GenericRows
          title="Ensaios de proficiência"
          loading={proficiency.isLoading}
          error={proficiency.error as Error | null}
          rows={(proficiency.data ?? []) as GenericRow[]}
          columns={['provider', 'programa', 'data_inicio', 'status']}
        />
      ) : null}

      {tab === 'audits' ? (
        <GenericRows
          title="Programa de auditorias internas"
          loading={audits.isLoading}
          error={audits.error as Error | null}
          rows={(audits.data ?? []) as GenericRow[]}
          columns={['titulo', 'data_planejada', 'status', 'responsavel_nome']}
        />
      ) : null}
    </div>
  );
}

function ReadinessPanel({
  title,
  setTitle,
  selected,
  setSelected,
  busy,
  assessments,
  assessmentsLoading,
  assessmentsError,
  snapshot,
  snapshotLoading,
  snapshotError,
  onCreate,
  onClassify,
}: {
  title: string;
  setTitle: (value: string) => void;
  selected: string;
  setSelected: (value: string) => void;
  busy: boolean;
  assessments: Array<{ id: string; titulo: string; status: string }>;
  assessmentsLoading: boolean;
  assessmentsError: Error | null;
  snapshot: Awaited<ReturnType<typeof getIsoSnapshot>> | undefined;
  snapshotLoading: boolean;
  snapshotError: Error | null;
  onCreate: () => Promise<void>;
  onClassify: (id: string, situation: string) => Promise<void>;
}) {
  if (assessmentsLoading) return <LoadingState />;
  if (assessmentsError) return <ErrorState message={assessmentsError.message} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader kicker="Avaliação" title="Criar ou abrir checklist" />
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <Field label="Título" value={title} onChange={(event) => setTitle(event.target.value)} />
          <SelectField label="Avaliação" value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Selecione</option>
            {assessments.map((row) => (
              <option key={row.id} value={row.id}>{row.titulo} · {row.status}</option>
            ))}
          </SelectField>
          <div className="flex items-end">
            <Button disabled={busy} onClick={() => void onCreate()}>Nova avaliação</Button>
          </div>
        </div>
      </Card>

      {!selected ? <EmptyState title="Selecione uma avaliação" /> : null}
      {selected && snapshotLoading ? <LoadingState /> : null}
      {selected && snapshotError ? <ErrorState message={snapshotError.message} /> : null}
      {selected && snapshot ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Aderência" value={`${snapshot.score}%`} tone={snapshot.score >= 80 ? 'good' : 'warn'} />
            <MetricCard label="Conformes" value={snapshot.conforme} />
            <MetricCard label="Parciais" value={snapshot.parcial} />
            <MetricCard label="Não conformes" value={snapshot.nao_conforme} tone={snapshot.nao_conforme ? 'bad' : 'good'} />
          </div>
          <TableShell>
            <thead><tr><Th>Requisito</Th><Th>Situação</Th><Th>Classificar</Th></tr></thead>
            <tbody>
              {snapshot.items.map((raw, index) => {
                const row = raw as GenericRow;
                const meta = (row.iso_requirement_catalog ?? {}) as GenericRow;
                const situation = String(row.situacao ?? 'nao_avaliado');
                return (
                  <tr key={String(row.id ?? index)}>
                    <Td>
                      <b>{String(row.requirement_code ?? '')} · {String(meta.titulo ?? '')}</b>
                      <div className="text-xs text-slate-500">Cláusula {String(meta.clause ?? '')} · {String(meta.categoria ?? '')}</div>
                    </Td>
                    <Td><Pill tone={situation === 'conforme' ? 'good' : situation === 'nao_conforme' ? 'bad' : 'warn'}>{situation}</Pill></Td>
                    <Td>
                      <SelectField
                        label="Situação"
                        value={situation}
                        disabled={busy}
                        onChange={(event) => void onClassify(String(row.id), event.target.value)}
                      >
                        {['nao_avaliado', 'conforme', 'parcial', 'nao_conforme', 'nao_aplicavel'].map((value) => <option key={value}>{value}</option>)}
                      </SelectField>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        </>
      ) : null}
    </div>
  );
}

function FindingsPanel({ rows, loading, error, busy, onConvert }: { rows: GenericRow[]; loading: boolean; error: Error | null; busy: boolean; onConvert: (id: string) => Promise<void> }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!rows.length) return <EmptyState title="Nenhum achado aberto" />;
  return (
    <TableShell>
      <thead><tr><Th>Achado</Th><Th>Requisito</Th><Th>Prazo</Th><Th>Status</Th><Th>Ações</Th></tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={String(row.id ?? index)}>
            <Td><b>{String(row.titulo ?? '')}</b><div className="text-xs text-slate-500">{String(row.descricao ?? '')}</div></Td>
            <Td>{String(row.requirement_code ?? '')} · {String(row.requisito ?? '')}</Td>
            <Td>{dateBr(row.prazo)}</Td>
            <Td><Pill tone={row.severidade === 'critica' || row.severidade === 'alta' ? 'bad' : 'warn'}>{String(row.status ?? '')}</Pill></Td>
            <Td>{row.nc_id ? <span className="text-xs">NC vinculada</span> : <Button busy={busy} variant="secondary" onClick={() => void onConvert(String(row.id))}>Converter em NC</Button>}</Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function GenericRows({ title, loading, error, rows, columns }: { title: string; loading: boolean; error: Error | null; rows: GenericRow[]; columns: string[] }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!rows.length) return <EmptyState title={`Nenhum registro em ${title}`} />;
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-5">
        <TableShell>
          <thead><tr>{columns.map((column) => <Th key={column}>{column.replaceAll('_', ' ')}</Th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => <Td key={column}>{column.includes('data') || column.includes('valid') ? dateBr(row[column]) : String(row[column] ?? '-')}</Td>)}
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>
    </Card>
  );
}
