import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ImportacoesPage } from './ImportacoesPage';
import { ImportacaoExcelPage } from './ImportacaoExcelPage';

// C2 — Importações consolidadas em abas (Manual/OCR + Excel). Cada aba é a página existente.
type Aba = 'manual' | 'excel';
export function ImportacoesShell({ inicial = 'manual' }: { inicial?: Aba }) {
  const [sp, setSp] = useSearchParams();
  const [aba, setAba] = useState<Aba>(() => { const t = sp.get('tab') as Aba | null; return t === 'manual' || t === 'excel' ? t : inicial; });
  function trocar(k: Aba) { setAba(k); setSp({ tab: k }, { replace: true }); }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant={aba === 'manual' ? 'primary' : 'ghost'} onClick={() => trocar('manual')}>Manual / OCR</Button>
        <Button variant={aba === 'excel' ? 'primary' : 'ghost'} onClick={() => trocar('excel')}>Excel</Button>
      </div>
      {aba === 'manual' ? <ImportacoesPage /> : <ImportacaoExcelPage />}
    </div>
  );
}
