import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PreferenciasPage } from './PreferenciasPage';
import { ConfigCamposPage } from './ConfigCamposPage';
import { NcConfigPage } from './NcConfigPage';
import { NotificacoesPage } from './NotificacoesPage';

// C4 — configurações do laboratório consolidadas em abas. Cada aba é a página existente.
// ConfigCamposPage tem suas próprias sub-abas via ?aba= (recebimento/laudo/...) — sem colisão (o shell usa estado local).
type Aba = 'preferencias' | 'campos' | 'nc' | 'notificacoes';
export function ConfiguracoesPage({ inicial = 'preferencias' }: { inicial?: Aba }) {
  const { hasRole } = useAuth();
  const abas: { key: Aba; label: string; ok: boolean }[] = [
    { key: 'preferencias', label: 'Preferências', ok: hasRole('admin', 'admin_consulte') },
    { key: 'campos', label: 'Campos', ok: hasRole('admin', 'admin_consulte') },
    { key: 'nc', label: 'Config de NC', ok: hasRole('admin', 'admin_consulte', 'gestor_qualidade') },
    { key: 'notificacoes', label: 'Notificações', ok: hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro') },
  ];
  const disp = abas.filter((a) => a.ok);
  const [sp, setSp] = useSearchParams();
  const [aba, setAba] = useState<Aba>(() => { const t = sp.get('tab') as Aba | null; if (t && disp.some((a) => a.key === t)) return t; return disp.some((a) => a.key === inicial) ? inicial : (disp[0]?.key ?? 'preferencias'); });
  function trocar(k: Aba) { setAba(k); setSp({ tab: k }, { replace: true }); }
  if (!disp.length) return <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Sem acesso às configurações.</Card>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {disp.map((a) => <Button key={a.key} variant={aba === a.key ? 'primary' : 'ghost'} onClick={() => trocar(a.key)}>{a.label}</Button>)}
      </div>
      {aba === 'preferencias' ? <PreferenciasPage /> : aba === 'campos' ? <ConfigCamposPage /> : aba === 'nc' ? <NcConfigPage /> : <NotificacoesPage />}
    </div>
  );
}
