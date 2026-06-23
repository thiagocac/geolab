import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { getConfigLab, saveConfigLab } from '../../lib/api/preferencias';
import { CAMPOS_RECEBIMENTO, initCampoState } from '../../lib/concreto/camposEnsaioLaudo';

export function CamposRecebimentoPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [campos, setCampos] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const podeEditar = hasRole('admin', 'admin_consulte', 'gestor_qualidade');
  const cfg = useQuery({
    queryKey: ['config_recebimento', member?.tenant_id ?? 'none'],
    enabled: !!member,
    queryFn: async () => (await getConfigLab(member?.tenant_id ?? ''))?.recebimento_campos ?? {},
  });
  useEffect(() => { if (cfg.data !== undefined) setCampos(initCampoState(CAMPOS_RECEBIMENTO, cfg.data)); }, [cfg.data]);
  const show = (k: string) => campos[k] !== false;
  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      await saveConfigLab(member.tenant_id, { recebimento_campos: campos });
      await qc.invalidateQueries({ queryKey: ['config_recebimento'] });
      await qc.invalidateQueries({ queryKey: ['config_concretagem'] });
      await qc.invalidateQueries({ queryKey: ['concretagem'] });
      toast('Campos do recebimento salvos.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  if (!member) return null;
  if (cfg.isLoading) return <LoadingState />;
  if (cfg.error) return <ErrorState message={(cfg.error as Error).message} />;
  return (
    <section className="space-y-4">
      <div>
        <p className="kicker">Configuração</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">Campos do recebimento</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Escolha quais campos aparecem para cada caminhão na tela de concretagem, na ficha de moldagem e no laudo. Nota fiscal e série são sempre exibidas para preservar a rastreabilidade.</p>
      </div>
      {!podeEditar ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Seu perfil pode visualizar esta configuração, mas apenas administradores ou gestão da qualidade podem alterá-la.</div> : null}
      <Card>
        <CardHeader title="Campos por caminhão">A configuração é dinâmica e vale para todas as obras do laboratório.</CardHeader>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {CAMPOS_RECEBIMENTO.map((f) => (
            <label key={f.key} className="flex cursor-pointer items-start gap-3 p-4">
              <input type="checkbox" className="mt-1" checked={show(f.key)} onChange={() => setCampos((p) => ({ ...p, [f.key]: !show(f.key) }))} />
              <span className="text-sm"><span className="font-bold text-slate-900 dark:text-slate-100">{f.label}</span>{f.hint ? <span className="mt-0.5 block text-xs text-slate-500">{f.hint}</span> : null}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800"><Button onClick={() => void salvar()} disabled={!podeEditar || busy}>{busy ? 'Salvando...' : 'Salvar campos do recebimento'}</Button></div>
      </Card>
    </section>
  );
}
