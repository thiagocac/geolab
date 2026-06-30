import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { getConfigLab, saveConfigLab } from '../../lib/api/preferencias';
import { CAMPOS_ENSAIO, CAMPOS_LAUDO, CAMPOS_RECEBIMENTO, CAMPOS_CONCRETAGEM, initCampoState, type CampoCatalogo } from '../../lib/concreto/camposEnsaioLaudo';

type AbaKey = 'ensaio' | 'laudo' | 'recebimento' | 'concretagem';
type ColunaKey = 'ensaio_campos' | 'laudo_campos' | 'recebimento_campos' | 'concretagem_campos';

const ABAS: { key: AbaKey; label: string; coluna: ColunaKey; cat: CampoCatalogo[]; titulo: string; desc: string; invalidate: string[] }[] = [
  { key: 'ensaio', label: 'Ensaio', coluna: 'ensaio_campos', cat: CAMPOS_ENSAIO,
    titulo: 'Campos do ensaio (tela de rompimento)',
    desc: 'Campos preenchidos ao romper o CP. Refletem nas colunas da tela de rompimento. Resultado (MPa) e data são sempre exibidos.',
    invalidate: ['rompimentos'] },
  { key: 'laudo', label: 'Laudo', coluna: 'laudo_campos', cat: CAMPOS_LAUDO,
    titulo: 'Seções e colunas do laudo (PDF)',
    desc: 'Blocos e colunas exibidos no laudo de resistência à compressão (NBR 5739) gerado pelo sistema. Resultado, data e nota fiscal são sempre exibidos.',
    invalidate: ['laudos'] },
  { key: 'recebimento', label: 'Recebimento', coluna: 'recebimento_campos', cat: CAMPOS_RECEBIMENTO,
    titulo: 'Campos por caminhão (recebimento)',
    desc: 'Campos de cada caminhão/NF na tela de concretagem, na ficha de moldagem e no laudo. Nota fiscal e série são sempre exibidas para a rastreabilidade.',
    invalidate: ['concretagem'] },
  { key: 'concretagem', label: 'Concretagem', coluna: 'concretagem_campos', cat: CAMPOS_CONCRETAGEM,
    titulo: 'Campos da concretagem (etapa 1)',
    desc: 'Campos da etapa 1 do atendimento. Aparecem na tela de concretagem e alimentam a ficha e o laudo. Cliente, obra e fck/traço são o núcleo e sempre aparecem.',
    invalidate: ['concretagem', 'laudos'] },
];

const ABA_KEYS = ABAS.map((a) => a.key);

export function ConfigCamposPage() {
  const { member, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const podeEditar = can('config.campos');

  const [aba, setAba] = useState<AbaKey>(() => {
    const a = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('aba') : null;
    return ABA_KEYS.includes(a as AbaKey) ? (a as AbaKey) : 'ensaio';
  });
  const [state, setState] = useState<Record<AbaKey, Record<string, boolean>>>({ ensaio: {}, laudo: {}, recebimento: {}, concretagem: {} });
  const [busy, setBusy] = useState(false);

  const cfg = useQuery({
    queryKey: ['config_campos', member?.tenant_id ?? 'none'],
    enabled: !!member,
    queryFn: () => getConfigLab(member?.tenant_id ?? ''),
  });

  useEffect(() => {
    const c = cfg.data as Record<string, unknown> | null | undefined;
    if (c === undefined) return;
    setState({
      ensaio: initCampoState(CAMPOS_ENSAIO, (c?.ensaio_campos ?? {}) as Record<string, unknown>),
      laudo: initCampoState(CAMPOS_LAUDO, (c?.laudo_campos ?? {}) as Record<string, unknown>),
      recebimento: initCampoState(CAMPOS_RECEBIMENTO, (c?.recebimento_campos ?? {}) as Record<string, unknown>),
      concretagem: initCampoState(CAMPOS_CONCRETAGEM, (c?.concretagem_campos ?? {}) as Record<string, unknown>),
    });
  }, [cfg.data]);

  const atual = ABAS.find((a) => a.key === aba) ?? ABAS[0];

  function toggleCampo(key: string) {
    setState((p) => ({ ...p, [aba]: { ...p[aba], [key]: !(p[aba][key] !== false) } }));
  }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      await saveConfigLab(member.tenant_id, { [atual.coluna]: state[aba] } as Record<string, unknown>);
      await qc.invalidateQueries({ queryKey: ['config_campos'] });
      for (const k of atual.invalidate) await qc.invalidateQueries({ queryKey: [k] });
      toast('Campos de ' + atual.label.toLowerCase() + ' salvos.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (!member) return null;
  if (cfg.isLoading) return <LoadingState />;
  if (cfg.error) return <ErrorState message={(cfg.error as Error).message} />;

  return (
    <section className="space-y-4">
      <div>
        <p className="kicker">Configuração</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">Config. de Campos</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Centraliza os campos configuráveis do laboratório: o que aparece na tela de rompimento (Ensaio), no laudo PDF (Laudo),
          por caminhão (Recebimento) e na concretagem. A configuração é dinâmica e vale para todas as obras do laboratório.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de campo">
        {ABAS.map((a) => {
          const ativo = aba === a.key;
          return (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setAba(a.key)}
              className={'rounded-2xl px-5 py-2.5 text-sm font-black transition ' + (ativo ? 'text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700')}
              style={ativo ? { background: 'var(--grad-brand)' } : undefined}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {!podeEditar ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Seu perfil pode visualizar esta configuração, mas apenas administradores ou gestão da qualidade podem alterá-la.</div> : null}

      <Card>
        <CardHeader title={atual.titulo}>{atual.desc}</CardHeader>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {atual.cat.map((f) => (
            <label key={f.key} className={'flex cursor-pointer items-start gap-3 p-4 ' + (f.indent ? 'pl-8' : '')}>
              <input type="checkbox" className="mt-1" checked={state[aba][f.key] !== false} disabled={!podeEditar} onChange={() => toggleCampo(f.key)} />
              <span className="text-sm">
                <span className="font-bold text-slate-900 dark:text-slate-100">{f.label}</span>
                {f.hint ? <span className="mt-0.5 block text-xs text-slate-500">{f.hint}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <Button onClick={() => void salvar()} disabled={!podeEditar || busy}>{busy ? 'Salvando...' : 'Salvar campos de ' + atual.label.toLowerCase()}</Button>
        </div>
      </Card>
    </section>
  );
}
