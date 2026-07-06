import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { MedicaoPage } from './MedicaoPage';
import { FaturasPage } from './FaturasPage';
import { ContratosFinanceiroPage } from './ContratosFinanceiroPage';

// C3 — módulo financeiro consolidado em abas. Cada aba é a página existente (papéis por aba).
type Aba = 'medicao' | 'faturas' | 'contratos';
export function FinanceiroPage({ inicial = 'medicao' }: { inicial?: Aba }) {
  const { hasRole } = useAuth();
  const abas: { key: Aba; label: string; ok: boolean }[] = [
    { key: 'medicao', label: 'Medição', ok: hasRole('admin', 'admin_consulte') },
    { key: 'faturas', label: 'Faturas', ok: hasRole('admin', 'admin_consulte', 'financeiro') },
    { key: 'contratos', label: 'Contratos', ok: hasRole('admin', 'admin_consulte') },
  ];
  const disp = abas.filter((a) => a.ok);
  const [aba, setAba] = useState<Aba>(disp.some((a) => a.key === inicial) ? inicial : (disp[0]?.key ?? 'medicao'));
  if (!disp.length) return <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Sem acesso ao financeiro.</Card>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {disp.map((a) => <Button key={a.key} variant={aba === a.key ? 'primary' : 'ghost'} onClick={() => setAba(a.key)}>{a.label}</Button>)}
      </div>
      {aba === 'medicao' ? <MedicaoPage /> : aba === 'faturas' ? <FaturasPage /> : <ContratosFinanceiroPage />}
    </div>
  );
}
