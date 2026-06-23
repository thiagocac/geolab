import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { getConfigLab, saveConfigLab } from '../../lib/api/preferencias';
import { CAMPOS_ENSAIO, CAMPOS_LAUDO, initCampoState, type CampoCatalogo } from '../../lib/concreto/camposEnsaioLaudo';

function listaCampos(cat: CampoCatalogo[], state: Record<string, boolean>, setState: (f: (p: Record<string, boolean>) => Record<string, boolean>) => void) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {cat.map((f) => (
        <label key={f.key} className={'flex cursor-pointer items-start gap-3 p-4 ' + (f.indent ? 'pl-8' : '')}>
          <input type="checkbox" className="mt-1" checked={state[f.key] !== false} onChange={() => setState((p) => ({ ...p, [f.key]: !(p[f.key] !== false) }))} />
          <span className="text-sm">
            <span className="font-bold text-slate-900 dark:text-slate-100">{f.label}</span>
            {f.hint ? <span className="mt-0.5 block text-xs text-slate-500">{f.hint}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function ControleLaudoPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [ensaio, setEnsaio] = useState<Record<string, boolean>>({});
  const [laudo, setLaudo] = useState<Record<string, boolean>>({});
  const [busyE, setBusyE] = useState(false);
  const [busyL, setBusyL] = useState(false);
  const podeEditar = hasRole('admin', 'admin_consulte', 'gestor_qualidade');

  const cfg = useQuery({
    queryKey: ['config_controle_laudo', member?.tenant_id ?? 'none'],
    enabled: !!member,
    queryFn: async () => {
      const c = await getConfigLab(member?.tenant_id ?? '');
      return { ensaio: c?.ensaio_campos ?? {}, laudo: c?.laudo_campos ?? {} };
    },
  });

  useEffect(() => {
    if (!cfg.data) return;
    setEnsaio(initCampoState(CAMPOS_ENSAIO, cfg.data.ensaio));
    setLaudo(initCampoState(CAMPOS_LAUDO, cfg.data.laudo));
  }, [cfg.data]);

  async function salvarEnsaio() {
    if (!member) return;
    setBusyE(true);
    try {
      await saveConfigLab(member.tenant_id, { ensaio_campos: ensaio });
      await qc.invalidateQueries({ queryKey: ['config_controle_laudo'] });
      await qc.invalidateQueries({ queryKey: ['rompimentos'] });
      toast('Campos do ensaio salvos.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusyE(false); }
  }

  async function salvarLaudo() {
    if (!member) return;
    setBusyL(true);
    try {
      await saveConfigLab(member.tenant_id, { laudo_campos: laudo });
      await qc.invalidateQueries({ queryKey: ['config_controle_laudo'] });
      await qc.invalidateQueries({ queryKey: ['laudos'] });
      toast('Seções do laudo salvas.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusyL(false); }
  }

  if (!member) return null;
  if (cfg.isLoading) return <LoadingState />;
  if (cfg.error) return <ErrorState message={(cfg.error as Error).message} />;

  return (
    <section className="space-y-4">
      <div>
        <p className="kicker">Configuração</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">Campos do ensaio e do laudo</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Escolha quais campos aparecem na tela de rompimento e quais seções saem no laudo de resistência à compressão (NBR 5739). A configuração é dinâmica: a tela de resultados lê os campos de ensaio e o PDF lê as seções do laudo. Resultado (MPa), data e nota fiscal são sempre exibidos.
        </p>
      </div>

      {!podeEditar ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Seu perfil pode visualizar esta configuração, mas apenas administradores ou gestão da qualidade podem alterá-la.</div> : null}

      <Card>
        <CardHeader title="Campos do ensaio (tela de rompimento)">Campos preenchidos ao romper o CP. Os marcados refletem no laudo.</CardHeader>
        {listaCampos(CAMPOS_ENSAIO, ensaio, setEnsaio)}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <Button onClick={() => void salvarEnsaio()} disabled={!podeEditar || busyE}>{busyE ? 'Salvando...' : 'Salvar campos do ensaio'}</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Seções do laudo (PDF)">Seções e colunas exibidas no laudo gerado pelo sistema.</CardHeader>
        {listaCampos(CAMPOS_LAUDO, laudo, setLaudo)}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <Button onClick={() => void salvarLaudo()} disabled={!podeEditar || busyL}>{busyL ? 'Salvando...' : 'Salvar seções do laudo'}</Button>
        </div>
      </Card>
    </section>
  );
}
