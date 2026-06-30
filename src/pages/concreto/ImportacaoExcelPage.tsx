import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Field';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { getConfigLab } from '../../lib/api/preferencias';
import { commitExcelImport } from '../../lib/api/excelImport';
import { exportBlankImportTemplate } from '../../lib/importacao/excelTemplates';
import { fieldsForResource, resourceLabel, type ImportResource, type ParsedImport } from '../../lib/importacao/excelModel';
import { parseImportWorkbook } from '../../lib/importacao/excelParser';

const resources: ImportResource[] = ['tracos', 'concretagens', 'recebimentos', 'resultados'];

export function ImportacaoExcelPage() {
  const { member } = useAuth();
  const toast = useToast();
  const [resource, setResource] = useState<ImportResource>('resultados');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const cfg = useQuery({ queryKey: ['config_campos', member?.tenant_id ?? 'none'], enabled: !!member, queryFn: () => getConfigLab(member?.tenant_id ?? '') });
  const fields = useMemo(() => fieldsForResource(resource, cfg.data as never), [resource, cfg.data]);

  async function baixarModelo() {
    await exportBlankImportTemplate(resource, cfg.data as never);
  }
  async function carregar(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try { setParsed(await parseImportWorkbook(file, resource, cfg.data as never)); }
    catch (e) { toast((e as Error).message, 'error'); setParsed(null); }
    finally { setBusy(false); }
  }
  async function enviar(dryRun: boolean) {
    if (!parsed) return;
    if (parsed.invalidRows > 0) { toast('Corrija os erros antes de enviar.', 'error'); return; }
    setBusy(true);
    try {
      const r = await commitExcelImport(parsed.resource, parsed.rows, dryRun);
      const msg = dryRun ? 'Validação do servidor concluída' : 'Importação concluída';
      toast(`${msg}: ${r.inserted} inseridos, ${r.updated} atualizados, ${r.skipped} ignorados.`, r.errors.length ? 'error' : 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  }

  if (!member) return null;
  if (cfg.isLoading) return <LoadingState />;
  if (cfg.error) return <ErrorState message={(cfg.error as Error).message} />;

  const erros = parsed?.issues.filter((i) => i.severity === 'erro') ?? [];
  const avisos = parsed?.issues.filter((i) => i.severity === 'aviso') ?? [];
  return (
    <div className="space-y-4">
      <PageHeader kicker="Importação" title="Importação por Excel" description="Modelos dinâmicos por Config. de Campos, validação prévia e envio em lote para traços, concretagens, recebimentos e resultados." />
      <Card>
        <CardHeader kicker="Fluxo seguro" title="1. Baixe o modelo · 2. Preencha · 3. Valide · 4. Envie">A planilha de modelo traz apenas os campos habilitados para o laboratório e uma aba de dicionário. Não altere os cabeçalhos.</CardHeader>
        <div className="grid gap-4 p-5 md:grid-cols-[280px_1fr]">
          <SelectField label="Recurso" value={resource} onChange={(e) => { setResource(e.target.value as ImportResource); setParsed(null); }}>
            {resources.map((r) => <option key={r} value={r}>{resourceLabel(r)}</option>)}
          </SelectField>
          <div className="flex flex-wrap items-end gap-3">
            <Button onClick={() => void baixarModelo()}>Baixar modelo em branco</Button>
            <label className="btn btn-secondary cursor-pointer">
              Selecionar planilha
              <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => void carregar(e.target.files?.[0])} />
            </label>
            {fileName ? <span className="text-sm font-semibold text-slate-500">{fileName}</span> : null}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader kicker="Campos do modelo" title={'Campos ativos para ' + resourceLabel(resource)}>{fields.length} coluna(s), derivadas da configuração atual do laboratório.</CardHeader>
        <div className="table-scroll p-5 pt-0"><table className="table"><thead><tr><th>Coluna</th><th>Tipo</th><th>Obrigatório</th><th>Orientação</th></tr></thead><tbody>{fields.map((f) => <tr key={f.key}><td className="font-mono text-xs">{f.header}</td><td>{f.type}</td><td>{f.required ? 'Sim' : 'Não'}</td><td className="text-slate-500">{f.hint ?? f.example ?? '-'}</td></tr>)}</tbody></table></div>
      </Card>

      {busy ? <LoadingState /> : parsed ? (
        <Card>
          <CardHeader kicker="Validação" title="Resultado da leitura">{parsed.rows.length} linha(s) lidas · {parsed.validRows} válidas · {parsed.invalidRows} com erro · {avisos.length} aviso(s).</CardHeader>
          <div className="grid gap-4 p-5">
            {erros.length || avisos.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Ocorrências encontradas.</strong> Revise a tabela abaixo antes de enviar.</div> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><strong>Planilha válida.</strong> Você pode fazer uma simulação no servidor ou gravar o lote.</div>}
            {(parsed.issues.length > 0) ? <div className="table-scroll"><table className="table"><thead><tr><th>Linha</th><th>Campo</th><th>Tipo</th><th>Mensagem</th></tr></thead><tbody>{parsed.issues.slice(0, 200).map((i, idx) => <tr key={idx}><td>{i.row}</td><td>{i.field}</td><td>{i.severity}</td><td>{i.message}</td></tr>)}</tbody></table></div> : null}
            <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => void enviar(true)} disabled={busy || parsed.invalidRows > 0}>Simular no servidor</Button><Button onClick={() => void enviar(false)} disabled={busy || parsed.invalidRows > 0}>Gravar lote</Button></div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
