import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ImportacoesPage } from './ImportacoesPage';
import { ImportacaoExcelPage } from './ImportacaoExcelPage';

// C2 — Importações consolidadas em abas (Manual/OCR + Excel). Cada aba é a página existente.
type Aba = 'manual' | 'excel';
export function ImportacoesShell({ inicial = 'manual' }: { inicial?: Aba }) {
  const [aba, setAba] = useState<Aba>(inicial);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant={aba === 'manual' ? 'primary' : 'ghost'} onClick={() => setAba('manual')}>Manual / OCR</Button>
        <Button variant={aba === 'excel' ? 'primary' : 'ghost'} onClick={() => setAba('excel')}>Excel</Button>
      </div>
      {aba === 'manual' ? <ImportacoesPage /> : <ImportacaoExcelPage />}
    </div>
  );
}
