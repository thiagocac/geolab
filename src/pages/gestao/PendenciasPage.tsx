import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { getPendenciasResumo, type Sev } from '../../lib/api/pendencias';
import { PEND_SECOES, type PendItem } from '../../lib/pendenciasNav';

// Console consolidado de pendencias do lab (exceção ao seletor de obra, como a agenda).
// Cada item: contagem grande clicável -> deep-link para a tela dona com filtro inicial.
// Linhas com contagem 0 colapsam; itens são filtrados pelo papel (roles) do usuário.
const SEV_COR: Record<Sev, string> = { danger: 'var(--magenta)', warning: '#d97706', info: 'var(--ink-soft)' };
const SEV_BG: Record<Sev, string> = { danger: 'rgba(197,17,126,0.08)', warning: 'rgba(217,119,6,0.08)', info: 'transparent' };

export function PendenciasPage() {
  const { member, hasRole } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['pendencias', member?.tenant_id ?? 'none'], enabled: !!member, queryFn: () => getPendenciasResumo(member!.tenant_id) });

  const secoesVisiveis = useMemo(() => {
    const data = q.data;
    if (!data) return [] as Array<{ area: string; itens: Array<PendItem & { count: number; sev: Sev }> }>;
    return PEND_SECOES.map((s) => ({
      area: s.area,
      itens: s.itens
        .filter((it) => hasRole(...it.roles))
        .map((it) => ({ ...it, count: data[it.chave].count, sev: data[it.chave].sev })),
    })).filter((s) => s.itens.length > 0);
  }, [q.data, hasRole]);

  const total = useMemo(() => secoesVisiveis.reduce((a, s) => a + s.itens.reduce((b, it) => b + it.count, 0), 0), [secoesVisiveis]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Gestão" title="Pendências" description="Visão consolidada do que exige ação no laboratório. Clique num número para ver os itens." />
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} />
        : total === 0 ? <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Nenhuma pendência no momento. Tudo em dia por aqui.</Card>
        : (
        <div style={{ display: 'grid', gap: 20 }}>
          {secoesVisiveis.map((s) => {
            const ativos = s.itens.filter((it) => it.count > 0);
            const zerados = s.itens.filter((it) => it.count === 0);
            return (
              <section key={s.area} style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{s.area}</div>
                {ativos.length === 0 ? <Card className="p-4 text-sm text-slate-500">Sem pendências nesta área.</Card> : (
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                    {ativos.map((it) => (
                      <button key={it.chave} type="button" onClick={() => nav(it.rota)}
                        style={{ textAlign: 'left', cursor: 'pointer', borderRadius: 14, border: '1px solid var(--line)', background: SEV_BG[it.sev], padding: 16, display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{it.titulo}</span>
                          <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: SEV_COR[it.sev] }}>{it.count}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{it.descricao}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: SEV_COR[it.sev] }}>ver itens →</span>
                      </button>
                    ))}
                  </div>
                )}
                {zerados.length > 0 ? <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Em dia: {zerados.map((it) => it.titulo).join(' · ')}</div> : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
