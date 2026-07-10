import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

// [v228] Shell generico de abas — generaliza o padrao C3/C4 (v168, FinanceiroPage/ConfiguracoesPage):
// aba ativa em ?tab= (replace, sem poluir historico), prop `inicial` para rotas legadas apontarem
// para a aba certa, RBAC por aba (ok=false esconde). Renderiza SO a aba ativa (paridade com C3/C4).
// Sub-abas internas de paginas (ex.: ConfigCamposPage) usam ?aba= — sem colisao com ?tab=.
export type ShellTab = { key: string; label: string; ok: boolean; render: () => ReactNode };

export function TabShell({ tabs, inicial, vazio }: { tabs: ShellTab[]; inicial?: string; vazio: string }) {
  const disp = tabs.filter((t) => t.ok);
  const [sp, setSp] = useSearchParams();
  const [aba, setAba] = useState<string>(() => {
    const t = sp.get('tab');
    if (t && disp.some((a) => a.key === t)) return t;
    if (inicial && disp.some((a) => a.key === inicial)) return inicial;
    return disp[0]?.key ?? '';
  });
  // Sincroniza quando a URL muda por navegacao (rota legada com `inicial` diferente, back/forward
  // com ?tab=). setState com valor igual nao re-renderiza (bail-out do React) — sem loop.
  useEffect(() => {
    const keys = new Set(tabs.filter((t) => t.ok).map((t) => t.key));
    const t = sp.get('tab');
    if (t && keys.has(t)) { setAba(t); return; }
    if (inicial && keys.has(inicial)) setAba(inicial);
  }, [tabs, sp, inicial]);
  function trocar(k: string) { setAba(k); setSp({ tab: k }, { replace: true }); }
  if (!disp.length) return <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">{vazio}</Card>;
  const atual = disp.find((a) => a.key === aba) ?? disp[0];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {disp.map((a) => <Button key={a.key} variant={aba === a.key ? 'primary' : 'ghost'} onClick={() => trocar(a.key)}>{a.label}</Button>)}
      </div>
      {atual.render()}
    </div>
  );
}
