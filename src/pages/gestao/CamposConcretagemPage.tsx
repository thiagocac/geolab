import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { getConfigLab, saveConfigLab } from '../../lib/api/preferencias';
import { CAMPOS_CONCRETAGEM, initCampoState } from '../../lib/concreto/camposEnsaioLaudo';

export function CamposConcretagemPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [campos, setCampos] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const podeEditar = hasRole('admin', 'admin_consulte', 'gestor_qualidade');
  const cfg = useQuery({
    queryKey: ['config_concretagem', member?.tenant_id ?? 'none'],
    enabled: !!member,
    queryFn: async () => (await getConfigLab(member?.tenant_id ?? ''))?.concretagem_campos ?? {},
  });
  useEffect(() => { if (cfg.data !== undefined) setCampos(initCampoState(CAMPOS_CONCRETAGEM, cfg.data)); }, [cfg.data]);
  const show = (k: string) => campos[k] !== false;
  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      await saveConfigLab(member.tenant_id, { concretagem_campos: campos });
      await qc.invalidateQueries({ queryKey: ['config_concretagem'] });
      await qc.invalidateQueries({ queryKey: ['concretagem'] });
      await qc.invalidateQueries({ queryKey: ['laudos'] });
      toast('Campos da concretagem salvos.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  if (!member) return null;
  if (cfg.isLoading) return <LoadingState />;
  if (cfg.error) return <ErrorState message={(cfg.error as Error).message} />;
  return (
    <section className="space-y-4">
      <div>
        <p className="kicker">Configuração</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">Campos da concretagem</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Configure os campos da etapa 1 do atendimento. Os campos habilitados aparecem na tela de concretagem e alimentam dinamicamente a ficha e o laudo PDF.</p>
      </div>
      {!podeEditar ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Seu perfil pode visualizar esta configuração, mas apenas administradores ou gestão da qualidade podem alterá-la.</div> : null}
      <Card>
        <CardHeader title="Campos da etapa 1 — Concretagem">Cliente, obra e fck/traço são mantidos como núcleo da rastreabilidade.</CardHeader>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {CAMPOS_CONCRETAGEM.map((f) => (
            <label key={f.key} className="flex cursor-pointer items-start gap-3 p-4">
              <input type="checkbox" className="mt-1" checked={show(f.key)} onChange={() => setCampos((p) => ({ ...p, [f.key]: !show(f.key) }))} />
              <span className="text-sm"><span className="font-bold text-slate-900 dark:text-slate-100">{f.label}</span>{f.hint ? <span className="mt-0.5 block text-xs text-slate-500">{f.hint}</span> : null}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800"><Button onClick={() => void salvar()} disabled={!podeEditar || busy}>{busy ? 'Salvando...' : 'Salvar campos da concretagem'}</Button></div>
      </Card>
    </section>
  );
}
